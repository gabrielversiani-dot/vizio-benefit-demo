import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Faturamento from "./pages/Faturamento";
import Sinistralidade from "./pages/Sinistralidade";
import SinistrosVida from "./pages/SinistrosVida";
import Contratos from "./pages/Contratos";
import Beneficiarios from "./pages/Beneficiarios";
import Relatorios from "./pages/Relatorios";
import MovimentacaoVidas from "./pages/MovimentacaoVidas";
import Demandas from "./pages/Demandas";
import PromocaoSaude from "./pages/PromocaoSaude";
import Configuracoes from "./pages/Configuracoes";
import CentralImportacao from "./pages/CentralImportacao";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faturamento"
                element={
                  <ProtectedRoute>
                    <Faturamento />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sinistralidade"
                element={
                  <ProtectedRoute>
                    <Sinistralidade />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sinistros-vida"
                element={
                  <ProtectedRoute>
                    <SinistrosVida />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contratos"
                element={
                  <ProtectedRoute>
                    <Contratos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/beneficiarios"
                element={
                  <ProtectedRoute>
                    <Beneficiarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <Relatorios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/movimentacao-vidas"
                element={
                  <ProtectedRoute>
                    <MovimentacaoVidas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/demandas"
                element={
                  <ProtectedRoute>
                    <Demandas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/promocao-saude"
                element={
                  <ProtectedRoute>
                    <PromocaoSaude />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/central-importacao"
                element={
                  <ProtectedRoute>
                    <CentralImportacao />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
