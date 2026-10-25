#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env.docker ]; then
  umask 077
  cp .env.docker.example .env.docker
fi
if grep -q '^BETTER_AUTH_SECRET=$' .env.docker; then
  secret=$(openssl rand -hex 32)
  sed "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$secret/" .env.docker > .env.docker.tmp
  chmod 600 .env.docker.tmp
  mv .env.docker.tmp .env.docker
fi
docker-compose --env-file .env.docker up -d --build
