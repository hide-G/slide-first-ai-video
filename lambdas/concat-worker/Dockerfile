# Stage 5: Concat - final video assembly with FFmpeg
# Requires: ffmpeg, ffprobe, libass (for subtitle burn-in)
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM public.ecr.aws/lambda/nodejs:22

# Install FFmpeg with libass support for subtitle burn-in
RUN dnf install -y ffmpeg libass && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

CMD ["dist/index.handler"]
