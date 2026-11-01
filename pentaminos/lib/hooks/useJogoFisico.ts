"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { estadoInicial, reducerFisico } from "@/lib/fisico/estado";
import {
  FonteEventos,
  FonteSimulada,
  FonteWebSocket,
  TipoFonte,
} from "@/lib/fisico/fontes";
import { StatusConexao } from "@/lib/types/fisico";

// Depois disso, usa a simulada.
export const ESPERA_WEBSOCKET_MS = 5000;

interface OpcoesJogoFisico {
  intervaloSimuladoMs?: number;
}

// Use key={sessaoId} na tela.
export function useJogoFisico(
  sessaoId: string,
  fontePreferida: TipoFonte,
  { intervaloSimuladoMs = 1000 }: OpcoesJogoFisico = {},
) {
  const [fonteAtiva, setFonteAtiva] = useState<TipoFonte>(fontePreferida);
  const [caiuParaSimulado, setCaiuParaSimulado] = useState(false);
  const [conexao, setConexao] = useState<StatusConexao>("conectando");
  const [houveQueda, setHouveQueda] = useState(false);

  const [estado, dispatch] = useReducer(
    reducerFisico,
    fontePreferida === "simulada",
    estadoInicial,
  );

  const conectouRef = useRef(false);

  useEffect(() => {
    const fonte: FonteEventos =
      fonteAtiva === "simulada"
        ? new FonteSimulada(sessaoId, intervaloSimuladoMs)
        : new FonteWebSocket(sessaoId);

    fonte.conectar(
      (mensagem) => dispatch({ tipo: "mensagem", mensagem }),
      (status) => {
        setConexao(status);

        if (status === "conectada") conectouRef.current = true;
        if (status === "desconectada") setHouveQueda(true);
      },
    );

    let espera: ReturnType<typeof setTimeout> | undefined;

    if (fonteAtiva === "websocket") {
      espera = setTimeout(() => {
        if (conectouRef.current) return;

        dispatch({ tipo: "reiniciar", detectarVitoriaLocal: true });
        setHouveQueda(false);
        setCaiuParaSimulado(true);
        setFonteAtiva("simulada");
      }, ESPERA_WEBSOCKET_MS);
    }

    return () => {
      clearTimeout(espera);
      fonte.desconectar();
    };
  }, [sessaoId, fonteAtiva, intervaloSimuladoMs]);

  return {
    estado,
    venceu: estado.vitoria !== null,
    conexao,
    reconectando: conexao === "conectando" && houveQueda,
    fonteAtiva,
    caiuParaSimulado,
  };
}
