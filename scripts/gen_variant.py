import re, glob, sys
variant=sys.argv[1]
ph=glob.glob('/tmp/phosphor/core-*/assets')[0]
rm=glob.glob('/tmp/remix/RemixIcon-*/icons')[0]
def inner(path):
    s=open(path).read()
    return re.sub(r'^<svg[^>]*>|</svg>$','',s.strip())
def phpair(name,w1,w2):
    return (inner(f'{ph}/{w1}/{name}-{w1}.svg'), inner(f'{ph}/{w2}/{name}-{w2}.svg'), '256')
def rmpair(cat,name):
    try: r=inner(f'{rm}/{cat}/{name}-line.svg')
    except FileNotFoundError: r=inner(f'{rm}/{cat}/{name}.svg')
    try: f=inner(f'{rm}/{cat}/{name}-fill.svg')
    except FileNotFoundError: f=r
    return (r,f,'24')
V={
 'v21':('Phosphor Bold outline + Fill active (phosphor-icons/core, MIT)',[phpair('wrench','bold','fill'),phpair('clipboard-text','bold','fill'),phpair('chats-circle','bold','fill'),phpair('gear-six','bold','fill'),phpair('user-circle','bold','fill'),phpair('phone','fill','fill'),phpair('hand','bold','bold')]),
 'v22':('Remix Icon line + fill (Remix-Design/RemixIcon, Remix Icon License v1.0)',[rmpair('Design','wrench'),rmpair('Document','clipboard'),rmpair('Communication','chat-1'),rmpair('System','settings-3'),rmpair('User & Faces','user-3'),rmpair('Device','phone'),rmpair('Editor','hand')]),
 'v23':('Phosphor Light outline + Duotone active (phosphor-icons/core, MIT)',[phpair('wrench','light','duotone'),phpair('clipboard-text','light','duotone'),phpair('chats-circle','light','duotone'),phpair('gear-six','light','duotone'),phpair('user-circle','light','duotone'),phpair('phone','fill','fill'),phpair('hand','light','light')]),
 'v24':('Phosphor Thin outline + Fill active (phosphor-icons/core, MIT)',[phpair('wrench','thin','fill'),phpair('clipboard-text','thin','fill'),phpair('chats-circle','thin','fill'),phpair('gear-six','thin','fill'),phpair('user-circle','thin','fill'),phpair('phone','fill','fill'),phpair('hand','thin','thin')]),
}
desc,pairs=V[variant]
keys=['wrench','clipboardText','chatsCircle','gearSix','userCircle','phone','hand']
vb=pairs[0][2]
out=[f"// EXPERIMENT {variant}: {desc}",
"// Inline SVGs extracted from the user's source-library archives (release sources-01). Panel icons only.",
"export type PhName="+"|".join(f"'{k}'" for k in keys),
"const paths:Record<PhName,{r:string;f:string}>={"]
for k,(r,f,_) in zip(keys,pairs):
    out.append(f"  {k}:{{r:`{r}`,f:`{f}`}},")
out.append("}")
out.append(f"""export default function PhIcon({{name,active,size=18,className}}:{{name:PhName;active?:boolean;size?:number;className?:string}}){{
  const p=paths[name]
  return <svg width={{size}} height={{size}} viewBox="0 0 {vb} {vb}" fill="currentColor" className={{className}} dangerouslySetInnerHTML={{{{__html:active?p.f:p.r}}}}/>
}}
""")
open('src/components/PhIcon.tsx','w').write('\n'.join(out))
print(variant, 'written')
