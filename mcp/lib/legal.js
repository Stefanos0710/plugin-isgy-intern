// Impressum and Datenschutzerklärung. The operator's details come from environment variables (see site.js `operator()`),
// so the postal address is not part of the public repository.
import { operator, LEGAL_UPDATED, REPO, SITE } from './site.js';
import { legalPage } from './pages.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function address(o) {
  if (!o.name || !o.street || !o.city || !o.email) return '<div class="warn">Die Anbieterangaben sind auf diesem Server noch nicht hinterlegt (Umgebungsvariablen <code>OPERATOR_NAME</code>, <code>OPERATOR_STREET</code>, <code>OPERATOR_CITY</code>, <code>OPERATOR_EMAIL</code>).</div>';
  return `<address>${esc(o.name)}<br>${esc(o.street)}<br>${esc(o.city)}</address>`;
}
const mail = (o) => (o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : '–');

export function impressumPage() {
  const o = operator();
  return legalPage('Impressum – ISGY Intern Plus', `
<h1>Impressum</h1>
<p class="stand">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>
<h2>Anbieter</h2>
${address(o)}
<h2>Kontakt</h2>
<p>E-Mail: ${mail(o)}<br>Schnelle Kontaktaufnahme außerdem über die <a href="${REPO}/issues" rel="noopener">Issues im GitHub-Projekt</a>.</p>
<h2>Art des Angebots</h2>
<p>ISGY Intern Plus ist ein <strong>privates, nicht-kommerzielles Hobbyprojekt</strong> ohne Gewinnerzielungsabsicht: eine kostenlose Browser-Erweiterung und ein kostenloser MCP-Server (diese Website), der KI-Assistenten Lesezugriff auf die eigenen Daten des Nutzers im Schulportal isgy-intern.de ermöglicht. Es gibt keine Werbung und keine kostenpflichtigen Leistungen.</p>
<h2>Keine Verbindung zur Schule</h2>
<p>Das Projekt ist <strong>inoffiziell</strong> und steht in keiner Verbindung zum Gymnasium Ismaning oder zum Betreiber des Portals isgy-intern.de. „ISGYintern“ und das Portal gehören ihren jeweiligen Betreibern.</p>
<h2>Marken und Logos</h2>
<p>Claude ist eine Marke von Anthropic, ChatGPT und OpenAI sind Marken von OpenAI, Gemini ist eine Marke von Google. Die Logos werden nur verwendet, um die unterstützten Dienste zu kennzeichnen; es besteht keine Verbindung zu den Unternehmen. Die SVG-Logos stammen aus dem MIT-lizenzierten Paket <code>@lobehub/icons-static-svg</code>; die Rechte an den Marken liegen bei den jeweiligen Inhabern.</p>
<h2>Haftung für Links</h2>
<p>Diese Website enthält Links zu externen Seiten (z. B. GitHub, Anleitungen der KI-Dienste). Auf deren Inhalte habe ich keinen Einfluss; verantwortlich ist jeweils der Betreiber der verlinkten Seite.</p>
<p class="stand">Siehe auch die <a href="/datenschutz">Datenschutzerklärung</a>.</p>`);
}

export function datenschutzPage() {
  const o = operator();
  return legalPage('Datenschutzerklärung – ISGY Intern Plus', `
<h1>Datenschutzerklärung</h1>
<p class="stand">Stand: ${LEGAL_UPDATED}</p>
<p>Hier steht, welche personenbezogenen Daten ich verarbeite, wenn du die Website <strong>${esc(SITE.replace('https://', ''))}</strong>, den MCP-Server oder die Browser-Erweiterung „ISGY Intern Plus“ nutzt – und was nicht.</p>

<h2>1. Verantwortlicher</h2>
${address(o)}
<p>E-Mail: ${mail(o)}</p>

<h2>2. Das Wichtigste in Kürze</h2>
<ul>
<li>Ohne Konto werden <strong>keine Daten dauerhaft gespeichert</strong>. Deine Zugangsdaten stecken nur verschlüsselt in den Zugriffs-Token, die dein KI-Assistent bekommt.</li>
<li>Mit Konto speichere ich: E-Mail-Adresse, einen Hash deines Konto-Passworts, optional deinen <strong>verschlüsselten</strong> isgy-intern-Zugang sowie deine Aufgaben und Notizen.</li>
<li>Im Schulportal wird <strong>nur gelesen</strong>, nie etwas geändert. Es gibt keine Werbung, kein Tracking, keine Analyse-Tools und keine Schriften oder Skripte von Dritten.</li>
</ul>

<h2>3. Besuch der Website</h2>
<p>Beim Aufruf der Seiten verarbeitet der Hosting-Anbieter technisch notwendige Verbindungsdaten (IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Browser-Angaben, Statuscode) in Server-Logdateien. Das ist für Auslieferung, Stabilität und Missbrauchsabwehr nötig. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und stabilen Betrieb). Die Logs werden vom Hosting-Anbieter nach dessen Vorgaben nur begrenzte Zeit aufbewahrt.</p>
<p>Die Website nutzt ausschließlich Systemschriften und eigene Dateien; es werden beim Aufruf keine Daten an Dritte nachgeladen.</p>

<h2>4. Konto (optional)</h2>
<p>Wenn du ein ISGY-KI-Konto erstellst, verarbeite ich:</p>
<ul>
<li><b>E-Mail-Adresse</b> und <b>Konto-Passwort</b> – das Passwort wird nur als Hash (scrypt) gespeichert, nie im Klartext;</li>
<li>den <b>isgy-intern-Zugang</b>, den du hinterlegst (Benutzername und Passwort <i>oder</i> die Browser-Sitzung, die die Erweiterung übergibt). Er wird mit AES-256-GCM verschlüsselt gespeichert; der Schlüssel liegt nicht in der Datenbank, sondern nur in der Konfiguration des Servers;</li>
<li>technische Zeitstempel (Erstellung, letzte Zugangs-Aktualisierung, letzte Synchronisierung der Erweiterung);</li>
<li>deine <b>Aufgaben und Notizen</b> (Text, Fälligkeitsdatum, erledigt-Status, Zeitstempel, ob von dir oder vom KI-Assistenten angelegt).</li>
</ul>
<p><b>Zweck:</b> dein Konto bereitstellen, deinen KI-Assistenten mit deinen Schuldaten verbinden und Notizen synchronisieren. <b>Rechtsgrundlage:</b> Art. 6 Abs. 1 lit. b DSGVO (Nutzung des von dir gewünschten Dienstes). Es gibt keine E-Mail-Bestätigung und keine Werbe-E-Mails; ich schreibe dir nicht ungefragt.</p>
<p><b>Speicherdauer:</b> bis du das Konto selbst löschst (Kontoseite → „Konto löschen“ – dabei werden Zugang und Notizen endgültig gelöscht). Einen gespeicherten Zugang kannst du jederzeit einzeln entfernen; „Überall abmelden“ macht alle Verbindungen ungültig.</p>

<h2>5. Zugriff auf das Schulportal isgy-intern.de</h2>
<p>Der Server ruft mit deinem Zugang, in deinem Auftrag und nur lesend deine Daten im Portal ab (Stundenplan, Vertretungsplan, Klassentagebuch, Klassenkalender, die Lehrer-Kürzel-Liste). Diese Daten werden nur zur Beantwortung der jeweiligen Anfrage verarbeitet und dafür kurzzeitig (je nach Datenart Minuten bis wenige Stunden) im Arbeitsspeicher der Server-Funktion zwischengespeichert; dieser wird bei Inaktivität verworfen. Sie werden <b>nicht</b> in der Datenbank abgelegt. Der Server schreibt nichts ins Portal.</p>

<h2>6. KI-Assistenten (Claude, ChatGPT, Gemini)</h2>
<p>Wenn du einen KI-Assistenten mit diesem Server verbindest, ruft dieser auf deine Veranlassung Daten ab (z. B. Stundenplan, Hausaufgaben, deine Notizen). Die Antworten des Servers werden dabei an den jeweiligen Anbieter (Anthropic, OpenAI bzw. Google) übertragen und dort nach <b>dessen</b> Datenschutzbestimmungen verarbeitet. Darauf habe ich keinen Einfluss; bitte informiere dich bei deinem Anbieter und schalte die Verbindung nur an, wenn du das möchtest. Du kannst sie jederzeit im Assistenten trennen.</p>

<h2>7. Browser-Erweiterung</h2>
<p>Die Erweiterung arbeitet <b>lokal in deinem Browser</b>. Ohne KI-Konto sendet sie keine Daten an mich oder Dritte. <b>Nur wenn du dich in ihren Einstellungen mit deinem KI-Konto anmeldest</b>, überträgt sie deine Aufgaben und Notizen sowie (bei Konten ohne gespeichertes Portal-Passwort) deine aktuelle isgy-intern-Sitzung (Cookies und Sitzungswert) an diesen Server. Abmelden in den Einstellungen beendet die Übertragung sofort.</p>

<h2>8. Cookies</h2>
<p>Nur wenn du dich auf der Website in dein Konto einloggst, wird ein <b>technisch notwendiges Cookie</b> (<code>isgy_s</code>, 30 Tage, HttpOnly, SameSite) gesetzt, damit du angemeldet bleibst. Es enthält keine Tracking-Informationen. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG und Art. 6 Abs. 1 lit. b DSGVO. Einwilligungspflichtige Cookies setze ich nicht.</p>

<h2>9. Empfänger und Auftragsverarbeiter</h2>
<table>
<tr><th>Anbieter</th><th>Zweck</th><th>Hinweis</th></tr>
<tr><td>Vercel Inc., USA</td><td>Hosting der Website und des Servers</td><td>Funktionen laufen in der Region Frankfurt (fra1); Auftragsverarbeitung, Drittlandübermittlung auf Basis von Standardvertragsklauseln bzw. EU-US Data Privacy Framework</td></tr>
<tr><td>Supabase Inc., USA</td><td>Datenbank für Konten und Notizen</td><td>Projekt in der Region Frankfurt (eu-central-1); Auftragsverarbeitung, Standardvertragsklauseln</td></tr>
<tr><td>GitHub (Microsoft), USA</td><td>Nur verlinkt (Quellcode, Anleitung)</td><td>Daten werden erst übertragen, wenn du den Link anklickst</td></tr>
</table>
<p>Eine Weitergabe an sonstige Dritte findet nicht statt.</p>

<h2>10. Kinder und Jugendliche</h2>
<p>Das Angebot richtet sich auch an Schülerinnen und Schüler. Ein <b>Konto</b> sollten nur Personen ab <b>16 Jahren</b> oder mit Einverständnis der Erziehungsberechtigten anlegen. Ohne Konto sind keine Daten gespeichert.</p>

<h2>11. Sicherheit</h2>
<p>Die Verbindung ist per TLS verschlüsselt. Zugangsdaten werden mit AES-256-GCM verschlüsselt, Passwörter mit scrypt gehasht, und die Datenbanktabellen sind nur über den Server erreichbar. Eine hundertprozentige Sicherheit gibt es bei keinem Online-Dienst.</p>

<h2>12. Deine Rechte</h2>
<p>Du hast das Recht auf <b>Auskunft</b> (Art. 15 DSGVO), <b>Berichtigung</b> (Art. 16), <b>Löschung</b> (Art. 17), <b>Einschränkung der Verarbeitung</b> (Art. 18), <b>Datenübertragbarkeit</b> (Art. 20) und <b>Widerspruch</b> (Art. 21). Löschen kannst du selbst jederzeit auf der <a href="/konto">Kontoseite</a>; für alles Weitere schreib mir an ${mail(o)}.</p>
<p><b>Beschwerderecht:</b> Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. beim Bayerischen Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, <a href="https://www.lda.bayern.de" rel="noopener">www.lda.bayern.de</a>.</p>

<h2>13. Änderungen</h2>
<p>Wenn sich Funktionen oder die Verarbeitung ändern, passe ich diese Erklärung an. Es gilt die jeweils hier veröffentlichte Fassung.</p>
<p class="stand">Siehe auch das <a href="/impressum">Impressum</a>.</p>`);
}
