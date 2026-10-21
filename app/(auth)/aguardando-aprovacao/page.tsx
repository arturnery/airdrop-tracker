import Link from "next/link";
import { Hourglass } from "lucide-react";

/**
 * Tela de espera após o cadastro.
 *
 * Existe porque o acesso é liberado manualmente: sem ela, a pessoa se cadastra,
 * tenta entrar, é recusada e conclui que algo quebrou. Dizer o que acontece a
 * seguir evita a mensagem de suporte que viria.
 */
export default function AguardandoAprovacaoPage() {
  return (
    <section className="text-center">
      <span
        className="bg-brand/10 text-brand-legivel mx-auto flex size-12 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Hourglass className="size-6" />
      </span>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Cadastro recebido
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Sua conta será liberada assim que o acesso for confirmado. O sistema não
        manda e-mail: depois da liberação, é só entrar com o e-mail e a senha do
        cadastro. Não precisa cadastrar de novo.
      </p>

      <div className="border-border mt-8 rounded-lg border p-4 text-left">
        <h2 className="text-sm font-medium">Enquanto isso</h2>
        <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
          <li>Confira se o e-mail do cadastro é o mesmo da sua assinatura.</li>
          <li>Se demorar, avise na comunidade que você já se cadastrou.</li>
        </ul>
      </div>

      <p className="text-muted-foreground mt-8 text-sm">
        Já foi liberado?{" "}
        <Link href="/entrar" className="text-foreground underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </section>
  );
}
