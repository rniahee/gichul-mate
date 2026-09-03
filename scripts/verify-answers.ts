import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractAnswerKey } from "./lib/parse-answer-key";
import type { ExtractionResult } from "./lib/types";

async function main() {
  const draftPath = process.argv[2];
  if (!draftPath) {
    console.error("사용법: npx tsx scripts/verify-answers.ts <draft JSON 경로>");
    process.exit(1);
  }

  const draft = JSON.parse(await readFile(draftPath, "utf-8")) as ExtractionResult;
  const pdfPath = path.resolve("data/raw", draft.sourceFile);

  console.log(`정답 그리드 추출 중: ${pdfPath}`);
  const answerKey = await extractAnswerKey(pdfPath);
  console.log(`정답 그리드에서 ${answerKey.size}개 문항 확인됨`);

  const mismatches: { questionNumber: number; extracted: string; grid: string }[] = [];
  const unconfirmed: { questionNumber: number; grid: string | undefined }[] = [];
  let matched = 0;

  for (const q of draft.questions) {
    if (q.questionNumber == null) continue;
    const gridAnswer = answerKey.get(q.questionNumber);

    if (!q.correctLabel) {
      unconfirmed.push({ questionNumber: q.questionNumber, grid: gridAnswer });
      continue;
    }

    if (gridAnswer == null) {
      unconfirmed.push({ questionNumber: q.questionNumber, grid: undefined });
      continue;
    }

    if (q.correctLabel === gridAnswer) {
      matched++;
    } else {
      mismatches.push({ questionNumber: q.questionNumber, extracted: q.correctLabel, grid: gridAnswer });
    }
  }

  console.log("");
  console.log("=== 대조 결과 ===");
  console.log(`일치: ${matched}문항`);
  console.log(`불일치: ${mismatches.length}문항`);
  for (const m of mismatches) {
    console.log(`  - 문제 ${m.questionNumber}: 추출값 "${m.extracted}" ≠ 정답표 "${m.grid}"`);
  }
  console.log(`미확정(추출값 없음 또는 정답표에 없음): ${unconfirmed.length}문항`);
  for (const u of unconfirmed) {
    console.log(`  - 문제 ${u.questionNumber}: 정답표 값 = ${u.grid ?? "(정답표에도 없음)"}`);
  }
}

main().catch((error) => {
  console.error("검증 실패:", error);
  process.exit(1);
});
