export default function Dashboard({ usuario }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '0.5rem' }}>
        Bienvenido, {usuario?.nombre} 👋
      </h2>
      <p style={{ color: '#6b7280', fontSize: '14px' }}>
        Selecciona una sección del menú para comenzar.
      </p>
    </div>
  )
}