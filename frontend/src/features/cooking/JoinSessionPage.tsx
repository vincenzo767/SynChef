import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuUsers } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { cookingApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import s from "./cooking.module.css";

const CODE_PATTERN = /^[A-Z0-9]{6,8}$/;

/** Join a friend's cook-along with a code (typed, or from an invite link /join/:code). */
export default function JoinSessionPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState((codeParam ?? "").toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const autoTried = useRef(false);

  const join = async (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      setError("Session codes are 6 letters or numbers.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const session = await cookingApi.join(normalized);
      navigate(`/cook/${session.id}`, { replace: true });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (codeParam && !autoTried.current) {
      autoTried.current = true;
      void join(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-join once from the invite link
  }, [codeParam]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void join(code);
  };

  return (
    <div className="container page page-enter" style={{ maxWidth: 560 }}>
      <PageHeader eyebrow="Cook together" title="Join a cook-along" subtitle="Enter the code your host shared. You'll see the same step and timers, live." />
      <Card>
        <form className="stack" onSubmit={submit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Session code"
            className={s.codeInput}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            placeholder="ABC123"
            autoFocus
          />
          <Button type="submit" variant="primary" size="lg" block loading={joining} icon={<LuUsers />}>
            Join kitchen
          </Button>
        </form>
      </Card>
    </div>
  );
}
