/** Acesso bloqueado: aberto fora da plataforma, por quem não é administrador ou com link de outra conta. */
export function AccessDenied({ message }: { message: string | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-primary-50 px-4">
      <div
        role="alert"
        className="flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-white p-7 text-center shadow-[0_1px_2px_rgba(11,37,64,0.06),0_4px_16px_rgba(11,37,64,0.08)]"
      >
        <h1 className="text-xl font-bold text-primary-900">Acesso restrito</h1>
        <p className="text-sm text-gray">{message ?? 'Você não tem permissão para ver este painel.'}</p>
      </div>
    </main>
  )
}
