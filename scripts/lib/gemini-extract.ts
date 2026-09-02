import { readFile } from "node:fs/promises";
import { GoogleGenAI, createPartFromBase64, createUserContent } from "@google/genai";
import type { ExtractedQuestion } from "./types";

const MODEL = "gemini-3.5-flash";

// 해설(explanation) 필드는 스키마에 아예 없음 — 모델이 뭘 출력하든 담을 자리가 없다.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: ["integer", "null"] },
          subjectName: { type: ["string", "null"] },
          content: { type: "string" },
          choices: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                content: { type: "string" },
              },
              required: ["label", "content"],
            },
          },
          correctLabel: { type: ["string", "null"] },
        },
        required: ["content", "choices", "correctLabel"],
      },
    },
  },
  required: ["questions"],
} as const;

const PROMPT = `이 이미지들은 한국 정보처리기사 필기시험 기출문제 해설집 PDF의 연속된 페이지입니다.
각 페이지에서 4지선다 객관식 문제를 찾아 다음 정보만 추출하세요:

- questionNumber: 문제 번호 (표시되어 있으면)
- subjectName: 문제가 속한 과목명 (예: "소프트웨어 설계"). 페이지에 표시가 없으면 null.
- content: 문제 지문 전체. 지문 맨 앞에 있는 "문항 번호 + 마침표"(예: "76. ", "79. ")는
  questionNumber 필드로 이미 별도로 추출하므로, content 안에는 절대 포함하지 마세요.
  문항 번호가 이미지에서 지문과 붙어 있는 것처럼 보여도 content는 번호를 뗀 본문부터
  시작해야 합니다.
- choices: 보기 4개. 각각 { label: "1"|"2"|"3"|"4", content: 보기 내용 }
- correctLabel: 정답 보기 번호("1"~"4" 중 하나). 표시가 없으면 null.

매우 중요한 제약 (반드시 지킬 것):
- 문제 아래에 있는 "해설", "풀이", "정답 설명" 같은 해설/풀이 문단은 절대로 출력하지 마세요.
  정답 번호(correctLabel)만 추출하고, 그 뒤에 이어지는 설명 문장은 완전히 무시하고 버리세요.
- content와 choices 필드에도 해설 문장이 섞여 들어가면 안 됩니다. 순수하게 문제 지문과 보기 내용만 담으세요.
- 표, 배열, 트리 그림, 코드가 문제 지문에 포함되어 있으면 최대한 텍스트로 옮겨 적으세요.
- 이 페이지 범위에서 발견한 모든 문제를 questions 배열에 담아 반환하세요. 문제가 없으면 빈 배열을 반환하세요.`;

export async function extractQuestionsFromPages(imagePaths: string[]): Promise<ExtractedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다 (.env 확인).");
  }
  const ai = new GoogleGenAI({ apiKey });

  const imageParts = await Promise.all(
    imagePaths.map(async (filePath) => {
      const buffer = await readFile(filePath);
      return createPartFromBase64(buffer.toString("base64"), "image/png");
    }),
  );

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([PROMPT, ...imageParts]),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }

  const parsed = JSON.parse(text) as { questions: ExtractedQuestion[] };
  return parsed.questions;
}
