import { useNavigate } from 'react-router-dom';

import { LogoIntro } from '../components/LogoIntro';
import { markIntroSeen } from '../lib/intro';
import { startTour } from '../lib/tour';

/** Demo opening, shown once per browser: then the guided tour, or straight to the app. */
export function WelcomePage() {
  const navigate = useNavigate();
  const finish = (tour: boolean) => {
    markIntroSeen();
    if (tour) startTour();
    navigate('/', { replace: true });
  };
  return <LogoIntro onTour={() => finish(true)} onExplore={() => finish(false)} />;
}
