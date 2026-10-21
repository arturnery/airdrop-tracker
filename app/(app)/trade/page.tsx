import { redirect } from "next/navigation";

// Trade é um grupo de páginas; o endereço do grupo leva à primeira.
export default function TradePage() {
  redirect("/trade/operacoes");
}
