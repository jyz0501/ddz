FROM node:18-alpine

WORKDIR /app

# 只拷贝运行所需文件
COPY server/server.js /app/server/server.js
COPY index.html /app/index.html
COPY styles.css /app/styles.css
COPY app.js /app/app.js
COPY logo.jpg /app/logo.jpg
COPY apple-touch-icon.png /app/apple-touch-icon.png
COPY favicon.png /app/favicon.png

ENV PORT=3000
ENV DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 3000

CMD ["node", "server/server.js"]
