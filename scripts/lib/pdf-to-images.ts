import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RenderedPage {
  pageNumber: number;
  filePath: string;
}

export interface RenderedPdf {
  pages: RenderedPage[];
  cleanup: () => Promise<void>;
}

// PDF 페이지를 PNG로 렌더링한다. 결과물은 OS 임시 디렉토리에만 저장되고
// 리포지토리 안에는 절대 남지 않는다 (cleanup()으로 반드시 정리).
export async function renderPdfToImages(pdfPath: string): Promise<RenderedPdf> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "gichul-mate-pdf-"));
  const outputPrefix = path.join(tempDir, "page");

  await execFileAsync("pdftoppm", ["-png", "-r", "200", pdfPath, outputPrefix]);

  const files = await readdir(tempDir);
  const pages: RenderedPage[] = files
    .filter((file) => file.endsWith(".png"))
    .map((file) => {
      const match = file.match(/-(\d+)\.png$/);
      const pageNumber = match ? parseInt(match[1], 10) : 0;
      return { pageNumber, filePath: path.join(tempDir, file) };
    })
    .sort((a, b) => a.pageNumber - b.pageNumber);

  return {
    pages,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}
