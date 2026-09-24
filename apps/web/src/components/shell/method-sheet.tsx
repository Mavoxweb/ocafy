"use client";

import { Sheet, SheetHead } from "@/components/ui/sheet";
import { closeSheet } from "@/lib/ui";

export function MethodSheet() {
  return (
    <Sheet onClose={closeSheet} label="Como o método funciona">
      <SheetHead onClose={closeSheet}>
        <h3>Como o método funciona</h3>
      </SheetHead>
      <h4>Janela, não data fixa</h4>
      <p>
        Cada tarefa tem um mínimo e um máximo de dias. Antes do mínimo, está em
        dia. Dentro da janela, pode fazer. Depois do máximo, atrasou. Isso evita
        a culpa do “era para ser terça” e mostra o que realmente importa hoje.
      </p>
      <h4>Âncoras de manhã e de noite</h4>
      <p>
        Hábitos pegam quando são presos a algo que você já faz: “depois do café,
        eu recolho a areia” e “depois do jantar, eu faço o reset”. O formato
        “quando X, faço Y” aumenta bastante a chance de cumprir.
      </p>
      <h4>Reset de 10 minutos</h4>
      <p>
        A bagunça é acúmulo de pequenas decisões adiadas. Dez minutos por noite
        devolvendo as coisas ao lugar impedem que ela chegue ao ponto de exigir
        um sábado inteiro.
      </p>
      <h4>Ordem que economiza trabalho</h4>
      <p>
        De cima para baixo (teto → móveis → chão), seco antes do molhado
        (aspirar → pano), e dar tempo ao produto: limpeza depende de ação
        mecânica, química, temperatura e tempo de contato. Pular o tempo de
        contato é o erro mais comum.
      </p>
      <h4>Registro e divisão justa</h4>
      <p>
        Cada “Feito” guarda quem fez e quando. O Placar compara pelo tempo
        estimado de cada tarefa, não pela quantidade — trocar a esponja não vale
        o mesmo que faxinar o banheiro.
      </p>
      <h4>Pontos, níveis e moedas</h4>
      <p>
        Cada tarefa vale 5 XP mais os minutos que ela leva. Fazer dentro da
        janela dá bônus; a rotina da manhã antes das 11h e o reset depois das
        18h também. A sequência 🔥 conta os dias seguidos com pelo menos 70% das
        rotinas diárias. A cada 10 XP você ganha 1 moeda da casa, e bater a meta
        de 1000 XP da dupla na semana rende +100 moedas para cada um — para
        gastar na Lojinha.
      </p>
      <h4>Revisão semanal</h4>
      <p>
        Domingo, 15 minutos juntos no Placar. Sem acusação: o objetivo é ajustar
        frequências e responsabilidades até a rotina caber na vida de vocês.
      </p>
    </Sheet>
  );
}
