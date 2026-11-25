import os, re, json, glob
# Regenera docs/entrevistas.md con las preguntas de todas las páginas: python3 scripts/gen-entrevistas.py
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','docs')
out=['''---
title: Repaso para entrevistas
sidebar_label: Repaso para entrevistas
sidebar_position: 99
slug: /entrevistas
description: Todas las preguntas de entrevista del curso en un solo lugar, por sección, con la respuesta escondida para practicar.
---

# Repaso para entrevistas

Todas las preguntas del curso, en orden. Leé la pregunta, respondé en voz
alta como si estuvieras en la entrevista y recién después abrí la
respuesta. El enlace de cada tema lleva a la explicación completa.

:::tip Cómo practicar
Respondé con un ejemplo de ripopola siempre que puedas: "en mi proyecto,
la búsqueda de pueblos cercanos usa…". Un ejemplo real vale más que una
definición de memoria.
:::
''']
total=0
for cat in sorted(d for d in os.listdir(D) if re.match(r'\d\d-',d)):
    label=json.load(open(f'{D}/{cat}/_category_.json'))['label']
    section=[]
    for f in sorted(glob.glob(f'{D}/{cat}/*.md')):
        s=open(f).read()
        title=re.search(r'^title: (.+)$',s,re.M).group(1)
        m=re.search(r'^## Preguntas de entrevista\s*\n(.*)',s,re.S|re.M)
        if not m: continue
        body=m.group(1)
        qs=re.findall(r'^\*\*\d+\.\s*(.+?)\*\*\s*\n(.+?)(?=\n\s*\n|\Z)',body,re.S|re.M)
        if not qs: continue
        rel=os.path.relpath(f,D)
        section.append(f'\n### [{title}](./{rel})\n')
        for q,a in qs:
            total+=1
            section.append(f'\n<details>\n<summary>{q.strip()}</summary>\n\n{a.strip()}\n\n</details>\n')
    if section:
        out.append(f'\n## {label}\n'); out+=section
out.append(f'\n---\n\n{total} preguntas en total.\n')
open(f'{D}/entrevistas.md','w').write(''.join(out))
print(total)
