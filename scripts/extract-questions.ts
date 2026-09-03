import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { QuotaExceededError, extractQuestionsFromPages } from "./lib/gemini-extract";
import { renderPdfToImages } from "./lib/pdf-to-images";
import type { ExtractedQuestion, ExtractionResult } from "./lib/types";

const PAGES_PER_CHUNK = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429(쿼터 초과)는 재시도해도 실패가 반복될 뿐이므로 즉시 던진다.
// 그 외(503 등 일시적 오류)만 대기 후 재시도한다.
async function extractWithRetry(imagePaths: string[]): Promise<ExtractedQuestion[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await extractQuestionsFromPages(imagePaths);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw error;
      }
      lastError = error;
      console.log(`     시도 ${attempt}/${MAX_ATTEMPTS} 실패: ${error instanceof Error ? error.message : error}`);
      if (attempt < MAX_ATTEMPTS) {
        console.log(`     ${RETRY_DELAY_MS / 1000}초 후 재시도...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

// 정보처리기사 필기는 5과목×20문항 고정 구조다 (spec.md 1.5절: 소프트웨어 설계 →
// 소프트웨어 개발 → 데이터베이스 구축 → 프로그래밍 언어 활용 → 정보시스템 구축관리,
// 문항 1-20/21-40/41-60/61-80/81-100). 페이지 청크가 과목 경계와 안 맞으면 모델이
// subjectName을 못 읽는 경우가 있어서, 문항번호로 결정론적으로 보정한다.
// 주의: 2027년 출제기준 개정 가능성이 있음(spec.md 1.5절) — 다른 포맷의 PDF가
// 추가되면 이 매핑이 안 맞을 수 있으니 재확인할 것.
const SUBJECT_BY_QUESTION_NUMBER: { max: number; subjectName: string }[] = [
  { max: 20, subjectName: "소프트웨어 설계" },
  { max: 40, subjectName: "소프트웨어 개발" },
  { max: 60, subjectName: "데이터베이스 구축" },
  { max: 80, subjectName: "프로그래밍 언어 활용" },
  { max: 100, subjectName: "정보시스템 구축관리" },
];

// 같은 청크를 재호출했을 때(예: 이전에 놓친 문제를 다시 뽑기 위해 completedChunks에서
// 해당 청크를 지우고 재실행) 문항번호가 같으면 새 결과로 덮어쓰고, 새 번호면 추가한다.
// 문항번호를 못 읽은 경우(null)는 중복 판단이 불가능하므로 그냥 추가한다.
function upsertQuestions(target: ExtractedQuestion[], incoming: ExtractedQuestion[]): void {
  for (const q of incoming) {
    if (q.questionNumber == null) {
      target.push(q);
      continue;
    }
    const existingIndex = target.findIndex((t) => t.questionNumber === q.questionNumber);
    if (existingIndex === -1) {
      target.push(q);
    } else {
      target[existingIndex] = q;
    }
  }
}

function backfillSubjectName(questions: ExtractedQuestion[]): number {
  let filled = 0;
  for (const q of questions) {
    if (q.subjectName || q.questionNumber == null) continue;
    const range = SUBJECT_BY_QUESTION_NUMBER.find((r) => q.questionNumber! <= r.max);
    if (range) {
      q.subjectName = range.subjectName;
      filled++;
    }
  }
  return filled;
}

async function loadExistingDraft(outputPath: string): Promise<ExtractionResult | null> {
  try {
    const raw = await readFile(outputPath, "utf-8");
    return JSON.parse(raw) as ExtractionResult;
  } catch {
    return null;
  }
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("사용법: npx tsx scripts/extract-questions.ts <PDF 경로>");
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(pdfPath);
  const outputDir = path.resolve("data/processed/draft");
  await mkdir(outputDir, { recursive: true });
  const outputBaseName = path.basename(absolutePdfPath, path.extname(absolutePdfPath));
  const outputPath = path.join(outputDir, `${outputBaseName}.json`);

  const existing = await loadExistingDraft(outputPath);
  const questions: ExtractedQuestion[] = existing?.questions ?? [];
  const completedChunks = new Set<string>(existing?.completedChunks ?? []);
  if (existing) {
    console.log(`이전 진행 상태 발견: 완료된 청크 ${completedChunks.size}개, 문제 ${questions.length}개 — 이어서 진행합니다.`);
  }

  const saveDraft = () => {
    const result: ExtractionResult = {
      sourceFile: path.basename(absolutePdfPath),
      extractedAt: new Date().toISOString(),
      completedChunks: [...completedChunks],
      questions,
    };
    return writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");
  };

  console.log(`[1/4] PDF 페이지 렌더링 중: ${absolutePdfPath}`);
  const { pages, cleanup } = await renderPdfToImages(absolutePdfPath);
  console.log(`  → ${pages.length}페이지 렌더링 완료`);

  const failedChunks: string[] = [];
  let quotaExceeded = false;

  try {
    const pageChunks = chunk(pages, PAGES_PER_CHUNK);
    console.log(`[2/4] Gemini로 추출 중 (${pageChunks.length}개 청크, 청크당 ${PAGES_PER_CHUNK}페이지)`);

    for (let i = 0; i < pageChunks.length; i++) {
      const pageChunk = pageChunks[i];
      const firstPage = pageChunk[0].pageNumber;
      const lastPage = pageChunk[pageChunk.length - 1].pageNumber;
      const chunkKey = `${firstPage}-${lastPage}`;

      if (completedChunks.has(chunkKey)) {
        console.log(`  → 청크 ${i + 1}/${pageChunks.length} (페이지 ${chunkKey}) 이미 완료됨, 건너뜀`);
        continue;
      }

      console.log(`  → 청크 ${i + 1}/${pageChunks.length} (페이지 ${chunkKey}) 처리 중...`);

      try {
        const chunkQuestions = await extractWithRetry(pageChunk.map((p) => p.filePath));
        console.log(`     문제 ${chunkQuestions.length}개 발견`);
        upsertQuestions(questions, chunkQuestions);
        completedChunks.add(chunkKey);
        await saveDraft();
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          console.log(`     일일 쿼터 소진: ${error.message}`);
          quotaExceeded = true;
          break;
        }
        console.log(`     청크 ${i + 1} 최종 실패, 건너뜀: ${error instanceof Error ? error.message : error}`);
        failedChunks.push(`페이지 ${chunkKey}`);
      }
    }
  } finally {
    await cleanup();
  }

  const backfilledCount = backfillSubjectName(questions);

  console.log(`[3/4] 형식 검증 중`);

  const issues: string[] = [];
  const subjectCounts = new Map<string, number>();
  let missingCorrectLabel = 0;

  for (const [index, q] of questions.entries()) {
    const label = q.questionNumber != null ? `문제 ${q.questionNumber}` : `${index + 1}번째 추출 항목`;

    if (q.choices.length !== 4) {
      issues.push(`${label}: 보기 개수가 4개가 아님 (${q.choices.length}개)`);
    }
    if (!q.correctLabel) {
      missingCorrectLabel++;
      issues.push(`${label}: 정답 표시 누락`);
    } else if (!q.choices.some((c) => c.label === q.correctLabel)) {
      issues.push(`${label}: correctLabel("${q.correctLabel}")과 일치하는 보기 label 없음`);
    }
    if (!q.content.trim()) {
      issues.push(`${label}: 문제 지문이 비어 있음`);
    }

    const subjectKey = q.subjectName ?? "(과목 미확인)";
    subjectCounts.set(subjectKey, (subjectCounts.get(subjectKey) ?? 0) + 1);
  }

  await saveDraft();

  console.log(`[4/4] 결과 저장 완료: ${outputPath}`);
  console.log("");
  console.log("=== 요약 ===");
  console.log(`총 문제 수: ${questions.length}`);
  console.log(`문항번호로 과목 보정: ${backfilledCount}건`);
  console.log(`과목별 분포:`);
  for (const [subject, count] of subjectCounts) {
    console.log(`  - ${subject}: ${count}문제`);
  }
  console.log(`정답 표시 누락: ${missingCorrectLabel}건`);
  if (failedChunks.length > 0) {
    console.log(`처리 실패한 청크 ${failedChunks.length}개 (재시도 필요): ${failedChunks.join(", ")}`);
  }
  console.log(`검증 이슈 총 ${issues.length}건${issues.length > 0 ? ":" : ""}`);
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
  console.log("");

  if (quotaExceeded) {
    console.log("⚠ 오늘 쿼터가 소진되어 중단했습니다. 진행 상황은 저장되었으니, 내일 쿼터 리셋 후");
    console.log(`  같은 명령으로 다시 실행하면 완료된 청크는 건너뛰고 이어서 처리합니다.`);
  } else {
    console.log(`검수 전 초안입니다: ${outputPath}`);
    console.log(`검수 완료 후 data/processed/${outputBaseName}.json 으로 옮기면 커밋 대상이 됩니다.`);
  }
}

main().catch((error) => {
  console.error("추출 실패:", error);
  process.exit(1);
});
