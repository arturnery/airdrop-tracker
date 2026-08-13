<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Backup antes de mudança relevante

Rodar `npm run backup -- --producao` **antes** de qualquer alteração que possa
afetar dados existentes, e avisar que foi feito.

Conta como relevante: migração de banco, script que apaga ou atualiza em lote,
mudança em como um valor é calculado ou gravado, e qualquer coisa que toque
produção. Na dúvida, rodar: leva segundos, e o arquivo em `backups/` é a única
proteção contra perda. Nem o rollback da Vercel nem o git alcançam o banco.

Não vale para mudança só de interface, texto ou documentação.
