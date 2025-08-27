import Layout from '@tpa/ui/src/components/Layout';
import { useRouter } from 'next/router';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  
  // Pages that should not use the old layout (they have their own headers)
  const pagesWithoutLayout = [
    '/',
    '/about',
    '/contribute/tasks',
    '/contribute/spec', 
    '/contribute/run-locally'
  ];
  
  if (pagesWithoutLayout.includes(router.pathname)) {
    return <Component {...pageProps} />;
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;
