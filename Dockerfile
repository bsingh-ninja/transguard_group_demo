# Hugging Face Docker Space: Postgres, the API and the web app in one container, served on :7860.
# Build and run locally:  docker build -t transguard-demo . && docker run --rm -p 7860:7860 -e GEMINI_API_KEY=... transguard-demo

FROM node:22-slim AS web
WORKDIR /web
RUN npm install -g pnpm@12.9.1
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
# The browser calls the API on the same origin; nginx forwards /api to FastAPI.
ENV NEXT_PUBLIC_API_URL=/api NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM python:3.12-slim
# deb.debian.org can stall from some networks; pass --build-arg DEBIAN_MIRROR=deb.debian.org to use the default
ARG DEBIAN_MIRROR=ftp.de.debian.org
RUN sed -i "s|deb.debian.org|$DEBIAN_MIRROR|g" /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql nginx curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=web /usr/local/bin/node /usr/local/bin/node
RUN useradd -m -u 1000 user
WORKDIR /app
RUN chown user:user /app
COPY backend/requirements.txt backend/requirements.txt
# pypi.org stalls on large downloads from some networks; pass --build-arg PIP_INDEX_URL=<mirror> to use a mirror
ARG PIP_INDEX_URL=https://pypi.org/simple
RUN pip install --no-cache-dir --timeout 120 --retries 10 -r backend/requirements.txt
USER user
ENV HOME=/home/user \
    PGDATA=/home/user/pgdata \
    DATABASE_URL=postgresql://demo@127.0.0.1:5432/demos \
    API_PORT=8002 \
    NEXT_TELEMETRY_DISABLED=1
COPY --chown=user:user backend/ backend/
COPY --chown=user:user deploy/ deploy/
# Seed the database and train the no-show model now, so a cold start only has to start the servers.
RUN bash deploy/run.sh --bake
COPY --chown=user:user --from=web /web web/
EXPOSE 7860
CMD ["bash", "deploy/run.sh"]
