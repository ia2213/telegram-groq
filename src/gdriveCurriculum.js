import { execFile } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFilePromise = util.promisify(execFile);

// Cache in-memory catalog of lessons
let catalogCache = null;
let lastCatalogFetch = 0;

export async function getCurriculumCatalog() {
  const now = Date.now();
  if (catalogCache && (now - lastCatalogFetch < 3600000)) {
    return catalogCache;
  }

  const levels = [
    { id: 'A1', name: 'Niveau A1 - Nicos Weg', path: 'Hub Allemand/Niveau A1 - Nicos Weg' },
    { id: 'A2', name: 'Niveau A2 - Nicos Weg', path: 'Hub Allemand/Niveau A2 - Nicos Weg' },
    { id: 'B1', name: 'Niveau B1 - Nicos Weg', path: 'Hub Allemand/Niveau B1 - Nicos Weg' },
    { id: 'B2', name: 'Niveau B2 - Jojo sucht das Glück', path: 'Hub Allemand/Niveau B2 - Allemand Avancé (Jojo sucht das Glück)' },
    { id: 'C1', name: 'Niveau C1 - Médical & Neurochirurgie (FSP)', path: 'Hub Allemand/Niveau C1 - Allemand Médical & FSP (Fachsprachenprüfung)' }
  ];

  const result = {};

  for (const lvl of levels) {
    try {
      const { stdout } = await execFilePromise('rclone', ['lsf', `gdrive:${lvl.path}`]);
      const files = stdout.split('\n')
        .map(f => f.trim())
        .filter(f => f.endsWith('.docx') || f.endsWith('.pdf') || f.endsWith('.xlsx'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      result[lvl.id] = {
        name: lvl.name,
        path: lvl.path,
        count: files.length,
        lessons: files
      };
    } catch (e) {
      console.error(`Error listing level ${lvl.id}:`, e.message);
      result[lvl.id] = { name: lvl.name, path: lvl.path, count: 0, lessons: [] };
    }
  }

  catalogCache = result;
  lastCatalogFetch = now;
  return result;
}

export async function fetchAndParseLesson(levelId, filename) {
  const catalog = await getCurriculumCatalog();
  const levelInfo = catalog[levelId];
  if (!levelInfo) throw new Error(`Niveau inconnu: ${levelId}`);

  const remotePath = `${levelInfo.path}/${filename}`;
  const tmpDir = path.join(os.tmpdir(), 'fluence_curriculum');
  fs.mkdirSync(tmpDir, { recursive: true });
  const localPath = path.join(tmpDir, filename);

  // Stream/copy file from Google Drive
  await execFilePromise('rclone', ['copyto', `gdrive:${remotePath}`, localPath]);

  // Read .docx using python zip parser
  const pythonScript = `
import zipfile, xml.etree.ElementTree as ET, sys, json
path = sys.argv[1]
with zipfile.ZipFile(path, 'r') as z:
    xml_content = z.read('word/document.xml')
    root = ET.fromstring(xml_content)
paragraphs = []
for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
    texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
    if texts:
        paragraphs.append("".join(texts))
print(json.dumps(paragraphs))
`;

  const { stdout } = await execFilePromise('python3', ['-c', pythonScript, localPath]);
  const paragraphs = JSON.parse(stdout);

  // Clean up temporary file immediately to keep 0 MB on disk
  try { fs.unlinkSync(localPath); } catch (_) {}

  return {
    level: levelId,
    title: filename.replace(/\.(docx|pdf)$/, ''),
    filename: filename,
    content: paragraphs.join('\n\n'),
    paragraphs: paragraphs
  };
}
