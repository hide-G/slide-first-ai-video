FROM public.ecr.aws/lambda/nodejs:22

# Install Chromium dependencies and Noto Sans CJK fonts
RUN dnf install -y \
    chromium \
    google-noto-sans-cjk-fonts \
    && dnf clean all

# Install marp-cli globally
RUN npm install -g @marp-team/marp-cli

# Set Chromium path for Marp
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy function code
COPY dist/ ${LAMBDA_TASK_ROOT}/

# Set the handler
CMD ["index.handler"]
