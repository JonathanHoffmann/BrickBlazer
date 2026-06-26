import { promises as fs } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parseTextLevel } from './src/levels/parseTextLevel';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const levelsDir = path.resolve(projectRoot, 'src/levels');

function isLevelFile(filePath: string): boolean {
  return filePath.startsWith(`${levelsDir}${path.sep}`) && /^level\d+\.txt$/.test(path.basename(filePath));
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');

      if (body.length > 20_000) {
        reject(new Error('Request body is too large'));
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

export default defineConfig({
  plugins: [
    {
      name: 'brickblaze-level-editor',
      handleHotUpdate(context) {
        if (isLevelFile(context.file)) {
          return [];
        }
      },
      configureServer(server) {
        server.middlewares.use('/__brickblaze/level-editor/load', async (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end('Method not allowed');
            return;
          }

          try {
            const payload = JSON.parse(await readRequestBody(request)) as { fileName?: unknown };

            if (typeof payload.fileName !== 'string' || !/^level\d+\.txt$/.test(payload.fileName)) {
              response.statusCode = 400;
              response.end('Invalid level filename');
              return;
            }

            const targetPath = path.resolve(levelsDir, payload.fileName);
            if (!targetPath.startsWith(`${levelsDir}${path.sep}`)) {
              response.statusCode = 400;
              response.end('Invalid level path');
              return;
            }

            const fileContents = await fs.readFile(targetPath, 'utf8');
            response.statusCode = 200;
            response.end(fileContents);
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : 'Unable to load level');
          }
        });

        server.middlewares.use('/__brickblaze/level-editor/save', async (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end('Method not allowed');
            return;
          }

          try {
            const payload = JSON.parse(await readRequestBody(request)) as { fileName?: unknown; text?: unknown };

            if (typeof payload.fileName !== 'string' || !/^level\d+\.txt$/.test(payload.fileName)) {
              response.statusCode = 400;
              response.end('Invalid level filename');
              return;
            }

            if (typeof payload.text !== 'string') {
              response.statusCode = 400;
              response.end('Invalid level text');
              return;
            }

            const levelData = parseTextLevel(payload.text, payload.fileName);

            if (levelData.grid.every((row) => row.every((brickType) => brickType === 0))) {
              response.statusCode = 400;
              response.end('Empty levels cannot be saved');
              return;
            }

            const targetPath = path.resolve(levelsDir, payload.fileName);
            if (!targetPath.startsWith(`${levelsDir}${path.sep}`)) {
              response.statusCode = 400;
              response.end('Invalid level path');
              return;
            }

            server.watcher.unwatch(targetPath);
            await fs.writeFile(targetPath, payload.text, 'utf8');
            server.watcher.add(targetPath);
            response.statusCode = 204;
            response.end();
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : 'Unable to save level');
          }
        });

        server.middlewares.use('/__brickblaze/level-editor/swap', async (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end('Method not allowed');
            return;
          }

          try {
            const payload = JSON.parse(await readRequestBody(request)) as {
              levels?: Array<{ fileName?: unknown; text?: unknown }>;
            };

            if (!Array.isArray(payload.levels) || payload.levels.length !== 2) {
              response.statusCode = 400;
              response.end('Expected exactly two level entries');
              return;
            }

            const entries = payload.levels.map((entry) => {
              if (typeof entry?.fileName !== 'string' || !/^level\d+\.txt$/.test(entry.fileName) || typeof entry.text !== 'string') {
                throw new Error('Invalid level swap payload');
              }

              return {
                fileName: entry.fileName,
                text: entry.text,
              };
            });

            if (entries[0].fileName === entries[1].fileName) {
              throw new Error('Swap targets must be different files');
            }

            const targetPaths = entries.map(({ fileName }) => {
              const targetPath = path.resolve(levelsDir, fileName);
              if (!targetPath.startsWith(`${levelsDir}${path.sep}`)) {
                throw new Error('Invalid level path');
              }
              return targetPath;
            });

            server.watcher.unwatch(targetPaths[0]);
            server.watcher.unwatch(targetPaths[1]);
            await fs.writeFile(targetPaths[0], entries[1].text, 'utf8');
            await fs.writeFile(targetPaths[1], entries[0].text, 'utf8');
            server.watcher.add(targetPaths[0]);
            server.watcher.add(targetPaths[1]);

            response.statusCode = 204;
            response.end();
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : 'Unable to swap levels');
          }
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    open: false,
    allowedHosts: ["pc50508-2230"],
  },
});