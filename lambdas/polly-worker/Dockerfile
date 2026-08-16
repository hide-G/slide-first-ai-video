# Stage 2: Audio - Amazon Polly TTS synthesis with ffprobe for duration measurement
# Requires: ffprobe
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM public.ecr.aws/lambda/nodejs:22

# Install ffprobe for audio duration measurement
RUN dnf install -y ffmpeg && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

CMD ["dist/index.handler"]
