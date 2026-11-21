import { useEffect } from "react";
import { initialMarkup } from "./markup";
import "./styles.css";

export default function App() {
  useEffect(() => {
    if (document.querySelector('script[data-portal-legacy="true"]')) return;
    const script = document.createElement("script");
    // Troque o número a cada versão nova, para o app baixar o legacy.js atualizado.
    script.src = "/legacy.js?v=10.21";
    script.dataset.portalLegacy = "true";
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: initialMarkup }} />
      <div id="avisoDireitos" className="direitos-overlay" aria-hidden="true">
        <section className="direitos-modal" role="dialog" aria-modal="true" aria-labelledby="direitosTitulo" aria-describedby="direitosDescricao">
          <div className="direitos-icone" aria-hidden="true">©</div>
          <h2 id="direitosTitulo">Compromisso com os direitos autorais</h2>
          <div id="direitosDescricao">
            <p>Publique somente histórias, textos e imagens de sua autoria ou materiais que você tenha autorização legal para utilizar.</p>
            <p><strong>Plágio e cópia não autorizada não são permitidos.</strong> A violação de direitos autorais pode gerar responsabilização civil e, conforme o caso e a legislação aplicável, consequências criminais.</p>
            <p>Contas que publicarem conteúdo plagiado ou violarem os direitos de terceiros poderão ter suas obras removidas e ser <strong>banidas permanentemente do Portal Novel</strong>.</p>
          </div>
          <label className="direitos-check">
            <input type="checkbox" id="confirmarDireitos" />
            <span>Declaro que compreendi e me comprometo a respeitar os direitos autorais.</span>
          </label>
          <div className="direitos-acoes">
            <button type="button" className="btn claro" id="cancelarDireitos">Voltar</button>
            <button type="button" className="btn" id="aceitarDireitos" disabled>Li e concordo — continuar</button>
          </div>
        </section>
      </div>
    </>
  );
}
