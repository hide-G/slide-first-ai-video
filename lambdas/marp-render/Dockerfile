# Stage 1: Pages - PDF/PPTX to PNG rasterization
# Requires: poppler-utils (pdftoppm), libreoffice (for PPTX), fonts
FROM public.ecr.aws/lambda/nodejs:22 AS builder

WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM public.ecr.aws/lambda/nodejs:22

# Install poppler-utils for pdftoppm and LibreOffice for PPTX conversion
RUN dnf install -y poppler-utils libreoffice-core libreoffice-impress \
    google-noto-sans-japanese-fonts google-noto-serif-japanese-fonts \
    && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

CMD ["dist/index.handler"]
