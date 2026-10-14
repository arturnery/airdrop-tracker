import { redirect } from "next/navigation";

// A Comunidade é um grupo de páginas; o endereço do grupo leva à primeira.
export default function ComunidadePage() {
  redirect("/comunidade/lives");
}
