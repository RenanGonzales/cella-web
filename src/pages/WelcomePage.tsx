import { useNavigate } from 'react-router-dom';

import { LogoIntro } from '../components/LogoIntro';
import { markIntroSeen } from '../lib/intro';

/** Demo opening, shown once per browser. The guided tour itself arrives in a later version. */
export function WelcomePage() {
  const navigate = useNavigate();
  const finish = (tour: boolean) => {
    markIntroSeen();
    navigate('/', { replace: true, state: { tour } });
  };
  return <LogoIntro onTour={() => finish(true)} onExplore={() => finish(false)} />;
}
