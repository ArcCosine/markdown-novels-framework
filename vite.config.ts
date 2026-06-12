import { defineConfig, Plugin } from "vite";
import fs from "fs";
import path from "path";

/**
 * 開発サーバー起動時、ルートの docs/ ディレクトリを静的ファイルとして配信する簡易プラグイン
 */
function serveDocsPlugin(): Plugin {
  return {
    name: "serve-docs",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/docs/")) {
          const filePath = path.join(process.cwd(), req.url.split("?")[0]);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            let contentType = "text/plain; charset=utf-8";

            if (ext === ".html") contentType = "text/html";
            else if (ext === ".css") contentType = "text/css";
            else if (ext === ".js") contentType = "application/javascript";
            else if (ext === ".png") contentType = "image/png";
            else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
            else if (ext === ".mp3") contentType = "audio/mpeg";
            else if (ext === ".md") contentType = "text/markdown; charset=utf-8";

            res.writeHead(200, { "Content-Type": contentType });
            if (req.method === "HEAD") {
              res.end();
            } else {
              fs.createReadStream(filePath).pipe(res);
            }
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [serveDocsPlugin()],
});
