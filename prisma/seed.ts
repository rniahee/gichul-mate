import "dotenv/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../app/generated/prisma/client";
import type { ExtractedQuestion, ExtractionResult } from "../scripts/lib/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// spec.md 1.5절 고정 순서. 5과목은 이 스크립트가 유일한 출처라 하드코딩한다.
const SUBJECTS = [
  { name: "소프트웨어 설계", order: 1 },
  { name: "소프트웨어 개발", order: 2 },
  { name: "데이터베이스 구축", order: 3 },
  { name: "프로그래밍 언어 활용", order: 4 },
  { name: "정보시스템 구축관리", order: 5 },
] as const;

// 공식 회차 번호 (comcbt.com 게시판 원본 제목 기준으로 확인됨)
const FILE_METADATA: Record<string, { year: number; round: number | null }> = {
  "정보처리기사20200606(해설집).pdf": { year: 2020, round: null },
  "정보처리기사20200822(해설집).pdf": { year: 2020, round: 3 },
  "정보처리기사20200926(해설집).pdf": { year: 2020, round: 4 },
  "정보처리기사20210307(해설집).pdf": { year: 2021, round: 1 },
  "정보처리기사20210515(해설집).pdf": { year: 2021, round: 2 },
  "정보처리기사20210814(해설집).pdf": { year: 2021, round: 3 },
  "정보처리기사20220305(해설집).pdf": { year: 2022, round: 1 },
  "정보처리기사20220424(해설집).pdf": { year: 2022, round: 2 },
};

interface ExcludedQuestion {
  sourceFile: string;
  questionNumber: number | null;
  reason: string;
}

// spec.md 순서대로 Subject 5개를 확보한다. 이름 기준으로 이미 있으면 재사용해서
// 재실행해도 중복 Subject가 안 생기게 한다.
async function ensureSubjects(): Promise<Map<string, string>> {
  const subjectIdByName = new Map<string, string>();

  for (const s of SUBJECTS) {
    const existing = await prisma.subject.findFirst({
      where: { name: s.name, examType: "WRITTEN" },
    });
    if (existing) {
      subjectIdByName.set(s.name, existing.id);
      continue;
    }
    const created = await prisma.subject.create({
      data: { name: s.name, order: s.order, examType: "WRITTEN" },
    });
    subjectIdByName.set(s.name, created.id);
  }

  return subjectIdByName;
}

// 보기 4개, correctLabel이 그 중 하나와 일치하는지 등 최소 구조 검증.
// 파이프라인 단계에서 이미 검증됐지만(0건이었음), seed 단계에서도 방어적으로 한 번 더 확인한다.
function findInvalidReason(q: ExtractedQuestion): string | null {
  if (!q.correctLabel) return "correctLabel이 null (정답 미확정)";
  if (q.choices.length !== 4) return `보기 개수가 4개가 아님 (${q.choices.length}개)`;
  if (!q.choices.some((c) => c.label === q.correctLabel)) {
    return `correctLabel("${q.correctLabel}")과 일치하는 보기 없음`;
  }
  if (!q.content.trim()) return "content가 비어 있음";
  return null;
}

async function seedQuestion(
  q: ExtractedQuestion,
  subjectIdByName: Map<string, string>,
  meta: { year: number; round: number | null },
): Promise<"created" | "skipped-duplicate"> {
  const subjectId = subjectIdByName.get(q.subjectName!)!;

  // (year, round, content) 기준으로 이미 있으면 건너뛴다 — DB에 자연 유니크 키가
  // 없어서 애플리케이션 레벨로 직접 체크. round까지 포함하는 이유: 같은 해의
  // 다른 회차에 동일한 지문의 문제가 실제로 재출제되는 경우가 있어서(예:
  // 2020년 여러 회차), content만으로 구분하면 서로 다른 회차의 진짜 별개
  // 문항을 같은 문항으로 오인해 건너뛰게 됨. 남은 한계: content를 나중에
  // 고친 뒤 재실행하면 "새 문항"으로 오인해 중복 생성될 수 있음(현재는 허용,
  // 필요해지면 개선).
  const existing = await prisma.question.findFirst({
    where: { year: meta.year, round: meta.round, content: q.content },
  });
  if (existing) return "skipped-duplicate";

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const question = await tx.question.create({
      data: {
        examType: "WRITTEN",
        subjectId,
        topicId: null, // 단원 태깅 데이터 없음 — 별도 태깅 작업 전까지 null
        year: meta.year,
        round: meta.round,
        content: q.content,
        // AI가 5단계에서 생성할 예정. comcbt.com 원본 해설은 저작권상 저장 금지라
        // 애초에 추출하지 않았음(파이프라인 조건 2).
        explanation: null,
      },
    });

    await tx.choice.createMany({
      data: q.choices.map((c) => ({
        questionId: question.id,
        label: c.label,
        content: c.content,
        isCorrect: c.label === q.correctLabel,
      })),
    });
  });

  return "created";
}

async function loadProcessedFiles(): Promise<string[]> {
  const dir = path.resolve("data/processed");
  const entries = await readdir(dir);
  return entries
    .filter((e) => e.endsWith(".json") && e !== "excluded-questions.json")
    .map((e) => path.join(dir, e));
}

interface FlatQuestion {
  sourceFile: string;
  meta: { year: number; round: number | null };
  q: ExtractedQuestion;
}

function parseLimitArg(): number | null {
  const arg = process.argv.find((a) => a.startsWith("--limit"));
  if (!arg) return null;
  const value = arg.includes("=") ? arg.split("=")[1] : process.argv[process.argv.indexOf(arg) + 1];
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`--limit 값이 올바르지 않음: "${value}"`);
  }
  return limit;
}

async function main() {
  const limit = parseLimitArg();

  const subjectIdByName = await ensureSubjects();
  console.log(`Subject ${subjectIdByName.size}개 확보`);

  const files = await loadProcessedFiles();
  console.log(`처리할 파일 ${files.length}개`);

  // 전체 문항을 먼저 하나의 목록으로 평탄화한 뒤, --limit이 있으면 앞에서부터 자른다.
  const flatQuestions: FlatQuestion[] = [];
  for (const filePath of files) {
    const data = JSON.parse(await readFile(filePath, "utf-8")) as ExtractionResult;
    const meta = FILE_METADATA[data.sourceFile];
    if (!meta) {
      throw new Error(`FILE_METADATA에 없는 파일: ${data.sourceFile}`);
    }
    for (const q of data.questions) {
      flatQuestions.push({ sourceFile: data.sourceFile, meta, q });
    }
  }

  const targets = limit ? flatQuestions.slice(0, limit) : flatQuestions;
  if (limit) {
    console.log(`--limit ${limit} 적용: 전체 ${flatQuestions.length}건 중 ${targets.length}건만 처리`);
  }

  let created = 0;
  let skippedDuplicate = 0;
  const excluded: ExcludedQuestion[] = [];

  for (const { sourceFile, meta, q } of targets) {
    const invalidReason = findInvalidReason(q);
    if (invalidReason) {
      excluded.push({ sourceFile, questionNumber: q.questionNumber, reason: invalidReason });
      continue;
    }

    const result = await seedQuestion(q, subjectIdByName, meta);
    if (result === "created") created++;
    else skippedDuplicate++;
  }

  if (excluded.length > 0) {
    const excludedPath = path.resolve("data/processed/excluded-questions.json");
    await writeFile(excludedPath, JSON.stringify(excluded, null, 2), "utf-8");
    console.log(`제외된 문항 ${excluded.length}건 → ${excludedPath}`);
  }

  console.log("");
  console.log("=== 요약 ===");
  console.log(`생성됨: ${created}건`);
  console.log(`이미 존재해서 건너뜀: ${skippedDuplicate}건`);
  console.log(`제외됨(정답 미확정 등): ${excluded.length}건`);
}

main()
  .catch((error) => {
    console.error("seed 실패:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
