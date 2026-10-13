import FitStudioForm from '../../components/FitStudioForm';

export default function FitStudioPage() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">✦</span>
          <span>Midnight Society KE<span className="brand-sub">POWERED BY ONLINE BAR</span></span>
        </a>
        <span className="top-status"><i /> HALLOWEEN LOOK PLANNING</span>
      </header>
      <FitStudioForm />
      <footer className="site-footer"><span>Midnight Society KE</span><span>POWERED BY ONLINE BAR</span><a href="https://onlinebar.co.ke/privacy">PRIVACY</a></footer>
    </main>
  );
}
