import { Link } from 'react-router-dom'
import './InfoPage.css'

function InfoPage() {
    return (
        <div className="info-page">
            <header className="info-header">
                <Link to="/" className="back-button" aria-label="Volver al mapa">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1>Información</h1>
            </header>

            <main className="info-content">
                {/* Section 1: What is V16 */}
                <section className="info-section">
                    <h2>¿Qué es una Baliza V16?</h2>
                    <p>
                        La <strong>Baliza V16</strong> es un dispositivo luminoso de emergencia que sustituye
                        a los triángulos de señalización en España. Desde el <strong>1 de enero de 2026</strong>,
                        es obligatorio llevar una baliza V16 conectada (con geolocalización DGT) en todos los vehículos.
                    </p>

                    <div className="info-card">
                        <h3>Características principales</h3>
                        <ul>
                            <li><strong>Luz ámbar intermitente</strong> visible a 1 km de distancia</li>
                            <li><strong>Geolocalización GPS</strong> que envía la posición a la DGT</li>
                            <li><strong>Base magnética</strong> para colocar sobre el techo del vehículo</li>
                            <li><strong>Batería recargable</strong> con autonomía mínima de 30 minutos</li>
                        </ul>
                    </div>

                    <div className="info-card info-card-highlight">
                        <h3>Ventaja de seguridad</h3>
                        <p>
                            Con la baliza V16, el conductor <strong>no necesita salir del vehículo</strong> para
                            señalizar una avería. Esto reduce drásticamente el riesgo de atropello, ya que el 80%
                            de los accidentes por avería ocurren al colocar los triángulos.
                        </p>
                    </div>
                </section>

                {/* Section 2: Data Sources */}
                <section className="info-section">
                    <h2>Origen de los datos</h2>
                    <p>
                        Este mapa muestra datos en <strong>tiempo real</strong> obtenidos directamente de
                        fuentes oficiales. No almacenamos datos personales ni información identificativa de los conductores.
                    </p>

                    <div className="info-card">
                        <h3>Fuentes oficiales</h3>
                        <p>
                            Utilizamos el sistema <strong>DATEX II</strong>, el estándar europeo para
                            intercambio de datos de tráfico. Recibimos información de tres fuentes:
                        </p>
                        <ul>
                            <li><strong>DGT Nacional</strong> — Red de carreteras del Estado</li>
                            <li><strong>Tráfico País Vasco</strong> — Red autonómica vasca</li>
                            <li><strong>Trànsit Catalunya</strong> — Red autonómica catalana</li>
                        </ul>
                    </div>

                    <div className="info-card">
                        <h3>Actualización de datos</h3>
                        <ul>
                            <li>Datos actualizados cada <strong>60 segundos</strong></li>
                            <li>Procesamiento automático 24/7</li>
                            <li>Historial de balizas almacenado para estadísticas</li>
                        </ul>
                    </div>
                </section>

                {/* Section 3: Vulnerability Algorithm */}
                <section className="info-section">
                    <h2>Sistema de alertas de vulnerabilidad</h2>
                    <p>
                        Hemos desarrollado un algoritmo que analiza cada baliza activa para identificar
                        conductores que podrían estar en <strong>situación de riesgo</strong>. El objetivo
                        es detectar personas que puedan necesitar asistencia urgente.
                    </p>

                    <div className="info-card">
                        <h3>Factores de riesgo analizados</h3>
                        <table className="factors-table">
                            <thead>
                                <tr>
                                    <th>Factor</th>
                                    <th>Peso</th>
                                    <th>Descripción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Aislamiento</strong></td>
                                    <td>35%</td>
                                    <td>Distancia al núcleo urbano más cercano. Mayor puntuación si está lejos de poblaciones.</td>
                                </tr>
                                <tr>
                                    <td><strong>Tiempo activo</strong></td>
                                    <td>30%</td>
                                    <td>Cuánto tiempo lleva la baliza encendida. A partir de 30 minutos aumenta el riesgo.</td>
                                </tr>
                                <tr>
                                    <td><strong>Horario nocturno</strong></td>
                                    <td>20%</td>
                                    <td>Penalización entre las 22:00 y las 06:00 por menor visibilidad y tráfico.</td>
                                </tr>
                                <tr>
                                    <td><strong>Tipo de vía</strong></td>
                                    <td>15%</td>
                                    <td>Autopistas y autovías tienen mayor puntuación por velocidad del tráfico.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="info-card">
                        <h3>Niveles de alerta</h3>
                        <div className="alert-levels">
                            <div className="alert-level alert-level-critical">
                                <span className="level-score">75-100</span>
                                <div>
                                    <strong>Crítico</strong>
                                    <p>Posible emergencia. Persona potencialmente en peligro.</p>
                                </div>
                            </div>
                            <div className="alert-level alert-level-high">
                                <span className="level-score">60-74</span>
                                <div>
                                    <strong>Alto</strong>
                                    <p>Situación preocupante que requiere atención.</p>
                                </div>
                            </div>
                            <div className="alert-level alert-level-medium">
                                <span className="level-score">50-59</span>
                                <div>
                                    <strong>Moderado</strong>
                                    <p>En seguimiento. Podría escalar si persiste.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 4: Privacy */}
                <section className="info-section">
                    <h2>Privacidad y datos</h2>
                    <div className="info-card">
                        <ul>
                            <li>No almacenamos información personal de los conductores</li>
                            <li>Las coordenadas provienen de fuentes públicas de la DGT</li>
                            <li>No es posible identificar al propietario de una baliza</li>
                            <li>Los datos históricos se utilizan únicamente para estadísticas agregadas</li>
                        </ul>
                    </div>
                </section>

                {/* Section 5: About */}
                <section className="info-section">
                    <h2>Sobre este proyecto</h2>
                    <p>
                        Este proyecto ha sido desarrollado por <a href="https://www.linkedin.com/in/ander-sein-a24097195/" target="_blank" rel="noopener noreferrer">Ander Sein</a> con
                        el objetivo de mejorar la seguridad vial en España mediante la visualización
                        de datos públicos de tráfico.
                    </p>
                    <p>
                        El código fuente está disponible en <a href="https://github.com/aseinotegi/DGT" target="_blank" rel="noopener noreferrer">GitHub</a>.
                    </p>
                </section>
            </main>

            <footer className="site-footer">
                <span>© 2026</span>
                <span className="footer-separator">|</span>
                <span>Desarrollado por <a href="https://www.linkedin.com/in/ander-sein-a24097195/" target="_blank" rel="noopener noreferrer">Ander Sein</a></span>
            </footer>
        </div>
    )
}

export default InfoPage
