"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ExamResultSubjectScore } from "@/types/exam";

interface ExamResultChartProps {
  subjectScores: ExamResultSubjectScore[];
}

// spec.md 4.1절: 평균 60점 기준선.
const AVERAGE_PASS_LINE = 60;

export function ExamResultChart({ subjectScores }: ExamResultChartProps) {
  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={subjectScores} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-rule)" vertical={false} />
            <XAxis dataKey="subjectName" tick={{ fill: "var(--color-ink)", fontSize: 12 }} stroke="var(--color-rule)" />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--color-ink)", fontSize: 12 }} stroke="var(--color-rule)" />
            <Tooltip
              contentStyle={{ background: "var(--color-paper)", border: "1px solid var(--color-rule)", fontSize: 12 }}
              formatter={(value) => [`${value}점`, "점수"]}
            />
            <ReferenceLine
              y={AVERAGE_PASS_LINE}
              stroke="var(--color-ink)"
              strokeDasharray="4 4"
              label={{
                value: `평균 합격선 ${AVERAGE_PASS_LINE}점`,
                position: "insideTopRight",
                fill: "var(--color-ink)",
                fontSize: 12,
              }}
            />
            {/* 과락(40점 미만)만 incorrect(빨강)로 강조하고, 통과는 focus(파랑)를 쓴다.
                correct(초록)는 일부러 안 쓴다 — "과목 통과"와 "정답"은 다른 개념이라,
                초록을 쓰면 "전부 정답이었다"는 오해를 줄 수 있어서다. */}
            <Bar dataKey="score" maxBarSize={56}>
              {subjectScores.map((s) => (
                <Cell key={s.subjectId} fill={s.isPassed ? "var(--color-focus)" : "var(--color-incorrect)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 차트는 스크린리더로 읽기 어려우므로, 같은 정보를 표로도 제공한다. */}
      <table className="mt-4 w-full border-collapse text-sm">
        <caption className="sr-only">과목별 점수와 과락 여부</caption>
        <thead>
          <tr className="border-b border-rule text-left text-ink/60">
            <th className="py-2 pr-4 font-medium">과목</th>
            <th className="py-2 pr-4 font-medium">점수</th>
            <th className="py-2 font-medium">판정</th>
          </tr>
        </thead>
        <tbody>
          {subjectScores.map((s) => (
            <tr key={s.subjectId} className="border-b border-rule">
              <td className="py-2 pr-4">{s.subjectName}</td>
              <td className="py-2 pr-4 font-mono">{s.score}점</td>
              <td className={"py-2 font-semibold " + (s.isPassed ? "text-focus" : "text-incorrect")}>
                {s.isPassed ? "통과 ✓" : "과락 ✗"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
