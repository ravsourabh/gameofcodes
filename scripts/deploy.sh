#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /home/deploy/sovereign
exec 9>/home/deploy/.gameofcodes-deploy.lock
flock -w 300 9
revision=$(git rev-parse HEAD)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/deploy/sovereign-backups/$stamp
mkdir -p "$backup"
rollback="sovereign:rollback-$stamp"
previous=$(docker inspect sovereign-sovereign-1 --format '{{.Image}}' 2>/dev/null || true)
if [ -n "$previous" ]; then
  docker tag "$previous" "$rollback"
  docker exec sovereign-sovereign-1 tar -C /app/.sovereign -czf - . > "$backup/data.tgz"
  printf '%s\n' "$previous" > "$backup/image-id"
fi
docker compose build --build-arg "GOC_BUILD_REVISION=$revision" sovereign
restore(){
  if [ -n "$previous" ]; then
    docker tag "$rollback" sovereign:latest
    docker compose up -d --no-deps --no-build sovereign
    echo 'Activation failed; previous image restored.' >&2
  fi
}
if ! docker compose up -d --no-deps sovereign; then restore;exit 1;fi
healthy=false
for attempt in $(seq 1 30); do
  if docker exec sovereign-sovereign-1 node --input-type=module -e '
    import https from "node:https";
    const agent=new https.Agent({rejectUnauthorized:false});
    const get=path=>new Promise((resolve,reject)=>{
      const request=https.get("https://127.0.0.1:5443"+path,{agent},res=>{
        let text="";res.on("data",chunk=>text+=chunk);
        res.on("end",()=>{try{if(res.statusCode!==200)throw new Error("HTTP "+res.statusCode);resolve(JSON.parse(text));}catch(error){reject(error);}});
      });
      request.setTimeout(4000,()=>request.destroy(new Error("Health timeout")));request.on("error",reject);
    });
    const [cap,release]=await Promise.all([get("/api/session-capabilities"),get("/release.json")]);
    if(!cap.discussion||!cap.guidedSetup||release.revision!==process.argv[1])process.exit(1);
  ' "$revision" > /dev/null 2>&1; then healthy=true;break;fi
  sleep 2
done
if [ "$healthy" != true ]; then
  restore
  exit 1
fi
docker compose ps
printf 'Deployed %s; data backup: %s\n' "$revision" "$backup/data.tgz"
