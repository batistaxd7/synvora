// O login é por nome de usuário. O Supabase exige um e-mail, então usamos um
// e-mail interno derivado do usuário. O e-mail de verdade fica só para recuperar a senha.
export function emailInterno(usuario: string) {
  return `${usuario.trim().toLowerCase()}@usuarios.synvora.app`;
}

export function usuarioValido(usuario: string) {
  return /^[a-z0-9._-]{3,30}$/.test(usuario.trim().toLowerCase());
}
