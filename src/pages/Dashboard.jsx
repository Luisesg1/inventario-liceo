export default function Dashboard({ usuario }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
        Bienvenido, {usuario?.nombre} 👋
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
        Selecciona una sección del menú para comenzar.
      </p>
    </div>
  )
}