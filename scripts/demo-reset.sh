#!/bin/bash
# НарядAI: одношаговый сброс демо-данных на hosted Supabase.
# Читает /home/sandbox/.naryadai/env. Удаляет служебного worker-c (Auth + employee),
# очищает наряды/журнал/фото/уведомления/кэш ИИ и заливает детерминированную
# синтетическую историю (520 закрытых нарядов, seed-эквивалент history-seed.mjs).
# НЕ трогает: учётки 5 демо-ролей, справочники, push-подписки.
set -e
source /home/sandbox/.naryadai/env
Q="https://api.supabase.com/v1/projects/pyqkstbcdxvpmtksziod/database/query"
echo '== apply demo-reset.sql'
python3 - <<'PY'
import json,urllib.request,os
sql=open('scripts/demo-reset.sql').read()
req=urllib.request.Request(os.environ['Q'] if False else "https://api.supabase.com/v1/projects/pyqkstbcdxvpmtksziod/database/query",
  data=json.dumps({'query':sql}).encode(),
  headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
print(urllib.request.urlopen(req).read().decode()[:300])
PY
echo '== delete worker-c auth user (if exists)'
WC=$(curl -s "$SUPABASE_URL/auth/v1/admin/users?page=1&per_page=50" -H "apikey: $SB_SERVICE" -H "Authorization: Bearer $SB_SERVICE" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next((u['id'] for u in d.get('users',[]) if u.get('email')=='worker-c@naryadai.test'),''))")
if [ -n "$WC" ]; then curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$WC" -H "apikey: $SB_SERVICE" -H "Authorization: Bearer $SB_SERVICE" >/dev/null; echo "deleted $WC"; else echo 'worker-c auth user not present'; fi
echo '== counts:'
curl -s -X POST "$Q" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"select (select count(*) from orders) orders,(select count(*) from order_events) events,(select count(*) from employees where role='"'"'worker'"'"') workers"}'
