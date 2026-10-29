#!/usr/bin/env bash
set -euo pipefail
umask 077
revision=${1:?Pass the verified release identity}
expected_image=${2:-}
[[ "$revision" =~ ^studio-[a-f0-9]{16}$ ]] || exit 2
release="/home/deploy/sovereign-releases/$revision"
[[ "$(realpath "$release")" == "$release" ]] || exit 2
cd "$release"
exec 9>/home/deploy/.gameofcodes-deploy.lock
flock -w 300 9
if [ -n "$expected_image" ] && [ "$(docker inspect sovereign-sovereign-1 --format '{{.Config.Image}}')" != "$expected_image" ]; then
  printf '%s\n' 'The live release changed after this candidate was prepared. Rebase the release before deploying.' >&2
  exit 1
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/home/deploy/sovereign-backups/studio-$stamp"
mkdir -p "$backup"
previous=$(docker inspect sovereign-sovereign-1 --format '{{.Image}}')
docker tag "$previous" "sovereign:rollback-$stamp"
docker exec sovereign-sovereign-1 tar -C /app/.sovereign --exclude='./studio/v1/*/exports' -czf - . > "$backup/data.tgz"
docker exec sovereign-sovereign-1 sh -c 'cd /app/.sovereign && find . -type f -exec sha256sum {} \;' > "$backup/before.sha256"
printf '%s\n' "$previous" > "$backup/image-id"
export GOC_IMAGE="sovereign:$revision"
docker compose -p sovereign -f compose.release.yml build --build-arg "GOC_BUILD_REVISION=$revision" sovereign
docker run --rm --entrypoint node "$GOC_IMAGE" --input-type=module -e '
 import fs from "node:fs";import {spawnSync} from "node:child_process";
 fs.accessSync(process.env.RHUBARB_PATH);
 for(const tool of ["ffmpeg","ffprobe"]){if(spawnSync(tool,["-version"]).status!==0)process.exit(1);}
'
if [ "$(docker inspect sovereign-sovereign-1 --format '{{.Image}}')" != "$previous" ]; then
  printf '%s\n' 'Another deployment changed the running image during the build. The running site is kept.' >&2
  exit 1
fi
restore(){ export GOC_IMAGE="sovereign:rollback-$stamp";docker compose -p sovereign -f compose.release.yml up -d --no-deps --no-build sovereign; }
if ! docker compose -p sovereign -f compose.release.yml up -d --no-deps --no-build sovereign; then restore;exit 1;fi
healthy=false
for attempt in $(seq 1 25); do
 if docker exec sovereign-sovereign-1 node --input-type=module -e '
  import https from "node:https";const agent=new https.Agent({rejectUnauthorized:false});
  const get=path=>new Promise((resolve,reject)=>{const r=https.get("https://127.0.0.1:5443"+path,{agent},res=>{let s="";res.on("data",c=>s+=c);res.on("end",()=>{try{if(res.statusCode!==200)throw new Error("HTTP");resolve(JSON.parse(s));}catch(e){reject(e);}});});r.setTimeout(4000,()=>r.destroy(new Error("timeout")));r.on("error",reject);});
  const [release,catalog]=await Promise.all([get("/release.json"),get("/api/studio/catalog")]);if(release.revision!==process.argv[1]||!catalog.capabilities.recording||!catalog.capabilities.export)process.exit(1);
 ' "$revision" >/dev/null 2>&1; then healthy=true;break;fi
 sleep 2
done
if [ "$healthy" != true ];then restore;exit 1;fi
docker exec sovereign-sovereign-1 sh -c 'cd /app/.sovereign && find . -type f -exec sha256sum {} \;' > "$backup/after.sha256"
python3 - "$backup" <<'PY'
import sys,pathlib,json,re,shutil,tarfile,subprocess
root=pathlib.Path(sys.argv[1])
def read(name):
 return {line.split('  ',1)[1]:line.split('  ',1)[0] for line in (root/name).read_text().splitlines()}
a,b=read('before.sha256'),read('after.sha256');changed=[name for name,sha in a.items() if b.get(name)!=sha]
report={'previousFileCount':len(a),'preservedFileCount':len(a)-len(changed),'changedOrMissing':changed};(root/'preservation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
# Keep one readable data checkpoint. Exported videos are disposable output.
with tarfile.open(root/'data.tgz','r:gz') as archive:
 assert archive.getmembers(), 'The new rollback checkpoint must be readable.'
assert root.parent==pathlib.Path('/home/deploy/sovereign-backups') and root.resolve()==root
removed=0
for old in root.parent.iterdir():
 if old==root or not re.fullmatch(r'studio-\d{8}T\d{6}Z',old.name):continue
 assert old.resolve()==old and old.is_dir() and not old.is_symlink()
 shutil.rmtree(old);removed+=1
read=lambda args:subprocess.check_output(args,text=True).strip()
protected={(root/'image-id').read_text().strip()}
for container in read(['docker','ps','-aq']).splitlines():protected.add(read(['docker','inspect',container,'--format','{{.Image}}']))
for line in read(['docker','image','ls','--no-trunc','--format','{{json .}}','sovereign']).splitlines():
 image=json.loads(line)
 if image['ID'] in protected or not re.fullmatch(r'(studio-[a-f0-9]{16}|rollback-\d{8}T\d{6}Z)',image['Tag']):continue
 subprocess.run(['docker','image','rm','sovereign:'+image['Tag']],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'olderBackupsRemoved':removed,'keptRollbackCheckpointBytes':(root/'data.tgz').stat().st_size}))
PY
printf 'Deployed %s. Backup %s. Previous image %s\n' "$revision" "$backup" "$previous"
