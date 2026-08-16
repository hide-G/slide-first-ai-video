# Stage 4: Clips - per-page video generation with FFmpeg
# Requires: ffmpeg, ffprobe
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM public.ecr.aws/lambda/nodejs:22

# Install FFmpeg
RUN dnf install -y ffmpeg && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

CMD ["dist/index.handler"]
