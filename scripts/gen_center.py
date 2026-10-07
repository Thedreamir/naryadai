import sys
base=open('/tmp/v25-variant/WorkerShell.tsx').read()
base=base.replace('className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3"','className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3 pb-16"')
OLD="""          {({isActive})=><span className={cn('flex flex-col items-center justify-center',isActive?'text-tk-amber':'') } style={isActive?undefined:{color:'var(--tk-muted)'}}>
            <span className={cn('rounded-full px-3 py-1 mb-0.5', isActive&&'bg-tk-amber/15')}><PhIcon name={t.icon} active={isActive} size={24}/></span><span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center">{t.label}</span>
          </span>}"""
CIRCLES={'v26': '<span className="relative flex h-14 w-14 items-center justify-center">\n                <span className="absolute inline-flex h-full w-full rounded-full bg-tk-amber opacity-40 animate-ping"></span>\n                <span className="relative flex h-14 w-14 rounded-full bg-tk-amber text-black items-center justify-center border-2 border-amber-600 shadow-lg"><PhIcon name="chatsCircle" size={26}/></span>\n              </span>', 'v27': '<span className="relative flex h-14 w-14">\n                <span className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-tk-amber shadow-lg">\n                  <img src="/ai-face.jpg" alt="Вымышленный цифровой помощник" className="h-full w-full object-cover"/>\n                  <span className="blink-eye" style={{left:\'26%\',backgroundPosition:\'-14.5px -19.5px\'}}></span>\n                  <span className="blink-eye" style={{left:\'57%\',backgroundPosition:\'-32px -19.5px\'}}></span>\n                </span>\n                <svg className="absolute -top-1 left-1/2 -translate-x-1/2" width="44" height="20" viewBox="0 0 44 20"><path d="M6 16 a16 14 0 0 1 32 0 z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/><rect x="2" y="15" width="40" height="4" rx="2" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/><rect x="20" y="2" width="4" height="14" rx="2" fill="#b45309"/></svg>\n                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-tk-amber text-black text-[0.4375rem] font-black px-1.5 py-px rounded-full border border-amber-600">ИИ</span>\n              </span>', 'v28': '<span className="relative flex h-14 w-14 items-center justify-center">\n                <span className="absolute h-14 w-14 rounded-full animate-[spin_9s_linear_infinite] border-2 border-tk-amber shadow-lg" style={{background:\'conic-gradient(from 0deg,#f59e0b,#451a03,#fbbf24,#0c0a09,#f59e0b)\'}}></span>\n                <span className="absolute h-10 w-10 rounded-full flex items-center justify-center" style={{background:\'var(--tk-bg)\'}}><PhIcon name="chatsCircle" size={22} className="text-tk-amber"/></span>\n                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-tk-amber text-black text-[0.4375rem] font-black px-1.5 py-px rounded-full border border-amber-600">ИИ</span>\n              </span>'}
v=sys.argv[1]
NEW_HEAD="""          {({isActive})=>t.icon==='chatsCircle'?(
            <span className="relative flex flex-col items-center justify-center -mt-1">
"""
NEW_TAIL="""
              <span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center mt-1" style={{color:isActive?'#f59e0b':'var(--tk-muted)'}}>{t.label}</span>
            </span>
          ):(<span className={cn('flex flex-col items-center justify-center',isActive?'text-tk-amber':'') } style={isActive?undefined:{color:'var(--tk-muted)'}}>
            <span className={cn('rounded-full px-3 py-1 mb-0.5', isActive&&'bg-tk-amber/15')}><PhIcon name={t.icon} active={isActive} size={24}/></span><span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center">{t.label}</span>
          </span>)}"""
assert OLD in base
open('src/layouts/WorkerShell.tsx','w').write(base.replace(OLD,NEW_HEAD+CIRCLES[v]+NEW_TAIL))
print('patched',v)
