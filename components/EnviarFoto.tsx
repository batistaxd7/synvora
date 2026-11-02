"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowser } from "@/lib/supabase/browser";

// Reduz a foto no próprio aparelho (foto de celular tem 3 a 8 MB) e envia direto para o Supabase.
async function reduzir(arquivo: File, lado: number): Promise<Blob> {
  let imagem: ImageBitmap | HTMLImageElement;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    imagem = await new Promise<HTMLImageElement>((ok, erro) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => erro(new Error("formato"));
      img.src = URL.createObjectURL(arquivo);
    });
  }
  const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("formato"))), "image/jpeg", 0.86));
}

function mensagem(e: unknown) {
  const t = e instanceof Error ? e.message : String(e);
  if (/formato/.test(t)) return "Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.";
  if (/bucket not found/i.test(t)) return "O banco ainda não está preparado para fotos. Rode o arquivo supabase/fotos.sql no Supabase.";
  if (/row-level security|unauthorized|403/i.test(t)) return "Sem permissão para enviar a foto. Rode o arquivo supabase/fotos.sql no Supabase e entre de novo.";
  return "Não foi possível enviar a foto: " + t;
}

export default function EnviarFoto({ bucket, pasta, nome, atual, salvar, rotulo = "Trocar foto", lado = 1000, pequeno = false }: {
  bucket: string; pasta: string; nome: string; atual: string | null;
  salvar: (url: string) => Promise<{ erro?: string } | void>;
  rotulo?: string; lado?: number; pequeno?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [previa, setPrevia] = useState<string | null>(atual);
  const [estado, setEstado] = useState<"" | "enviando" | "ok">("");
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setEstado("enviando");
    try {
      const blob = await reduzir(arquivo, lado);
      setPrevia(URL.createObjectURL(blob));
      const supabase = createBrowser();
      const caminho = `${pasta}/${nome}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(caminho, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const url = supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl;
      const r = await salvar(url);
      if (r && r.erro) throw new Error(r.erro);
      setPrevia(url);
      setEstado("ok");
      router.refresh();
      setTimeout(() => setEstado(""), 2500);
    } catch (err) {
      setPrevia(atual);
      setEstado("");
      setErro(mensagem(err));
    }
  }

  const tam = pequeno ? 48 : 72;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: pequeno ? 8 : 14, flexWrap: "wrap" }}>
      <button type="button" className="foto-alvo" style={{ width: tam, height: tam }} onClick={() => entrada.current?.click()} aria-label={rotulo} title={rotulo} disabled={estado === "enviando"}>
        {previa ? <img src={previa} alt="" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h3l2-3h8l2 3h3v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>}
        {estado === "enviando" && <span className="foto-carregando" />}
      </button>
      {!pequeno && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => entrada.current?.click()} disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando..." : rotulo}
          </button>
          {estado === "ok" && <span style={{ fontSize: 12, color: "var(--ok-ink)", fontWeight: 600 }}>Foto salva ✓</span>}
        </div>
      )}
      <input ref={entrada} type="file" accept="image/*" hidden onChange={escolher} />
      {erro && <div className="erro" style={{ flexBasis: "100%", fontSize: 13 }}>{erro}</div>}
    </div>
  );
}
