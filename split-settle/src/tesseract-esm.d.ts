// tesseract.js ships a prebuilt ESM bundle without its own typings; it exports the same API as the package
declare module "tesseract.js/dist/tesseract.esm.min.js" {
  import Tesseract from "tesseract.js";
  export default Tesseract;
}
