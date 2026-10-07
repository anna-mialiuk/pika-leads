import Header from "../../sections/Header/Header";
import Footer from "../Footer/Footer";

/** Спільний каркас сторінки: хедер → main → футер */
function Layout({ children, className = "", style }) {
  return (
    <>
      <Header />

      <main className={className} style={style}>
        {children}
      </main>

      <Footer />
    </>
  );
}

export default Layout;
