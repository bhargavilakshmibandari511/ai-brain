import re
import logging
import os
import asyncio
import fitz  # PyMuPDF
import PyPDF2  # Fallback
import pdfplumber # Ultimate Fallback
import pytesseract
from pdf2image import convert_from_path
from typing import List

# Configure OCR Paths specifically for Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
POPPLER_PATH = r'C:\Program Files\poppler-25.12.0\Library\bin'


logger = logging.getLogger(__name__)

class PDFReader:
    def __init__(self):
        self.chunk_size = 1000
        self.chunk_overlap = 200

    async def extract_text(self, file_path: str) -> str:
        """Extract text from PDF file using PyMuPDF"""
        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text() + "\n"
            doc.close()
            text = self.clean_text(text)
            if text:
                print(f"✅ PyMuPDF extracted {len(text)} characters from {file_path}")
            
            # Fallback to PyPDF2 or pdfplumber if PyMuPDF extracted nothing usable
            if not text:
                logger.info("PyMuPDF returned empty text. Falling back to pdfplumber/PyPDF2.")
                
                # Try pdfplumber
                try:
                    def extract_plumber():
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            t = ""
                            for page in pdf.pages:
                                page_text = page.extract_text()
                                if page_text:
                                    t += page_text + "\n"
                            return t
                    text = await asyncio.to_thread(extract_plumber)
                    if text:
                        print(f"✅ pdfplumber fallback extracted {len(text)} characters")
                except Exception as plumb_e:
                    logger.warning(f"pdfplumber failed: {plumb_e}")
                    text = ""
                
                # Try PyPDF2
                if not text:
                    try:
                        def extract_pypdf2():
                            import PyPDF2
                            with open(file_path, "rb") as f:
                                pdf_reader = PyPDF2.PdfReader(f)
                                t = ""
                                for page in pdf_reader.pages:
                                    page_text = page.extract_text()
                                    if page_text:
                                        t += page_text + "\n"
                                return t
                        text = await asyncio.to_thread(extract_pypdf2)
                        if text:
                            print(f"✅ PyPDF2 fallback extracted {len(text)} characters")
                    except Exception as pypdf_e:
                        logger.warning(f"PyPDF2 failed: {pypdf_e}")
                        text = ""
                
                # Ultimate Fallback: OCR (Optical Character Recognition)
                if not text:
                    logger.info("No text extracted from PDF. This may be a scanned image. Attempting OCR...")
                    try:
                        from pdf2image import convert_from_path
                        
                        def get_images():
                            return convert_from_path(file_path, poppler_path=POPPLER_PATH)
                        
                        images = await asyncio.to_thread(get_images)
                        
                        # Try Tesseract first (fast)
                        tesseract_text = ""
                        for img in images[:5]: # Check first 5 pages for speed
                            tesseract_text += pytesseract.image_to_string(img) + "\n"
                        
                        # If Tesseract is poor (e.g. mostly garbage or very short for a 20-page doc)
                        # or if we want to try VLM for better results on handwriting
                        if len(tesseract_text.strip()) < 100:
                            logger.info("Tesseract produced very little text. Trying VLM (LLaVA) for better OCR...")
                            from services.vlm_service import vlm_understand, check_vlm_available
                            
                            if await check_vlm_available():
                                vlm_text = ""
                                # Limit VLM to first 3 pages to avoid excessive delay (avg 5-10s per page)
                                for img in images[:3]:
                                    import io
                                    img_byte_arr = io.BytesIO()
                                    img.save(img_byte_arr, format='JPEG')
                                    page_content = await vlm_understand(
                                        img_byte_arr.getvalue(),
                                        "Transcribe all text from this handwritten or scanned document. "
                                        "Be extremely accurate with technical terms and diagrams.",
                                        task="ocr"
                                    )
                                    vlm_text += page_content + "\n"
                                
                                if len(vlm_text.strip()) > len(tesseract_text.strip()):
                                    text = vlm_text
                                else:
                                    text = tesseract_text
                            else:
                                text = tesseract_text
                        else:
                            text = tesseract_text

                    except Exception as ocr_e:
                        logger.warning(f"OCR failed: {ocr_e}")
                        text = "Document appears to be a scanned image and OCR extraction failed."

                text = self.clean_text(text)
                
            return text
        except Exception as e:
            logger.error(f"PyMuPDF failed, trying PyPDF2 fallback directly: {e}")
            try:
                with open(file_path, "rb") as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in pdf_reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                return self.clean_text(text)
            except Exception as inner_e:
                logger.error(f"PDF extraction completely failed: {inner_e}")
                raise e

    def extract_text_by_page(self, file_path: str) -> List[dict]:
        """Extract text per page with page numbers"""
        try:
            doc = fitz.open(file_path)
            pages = []
            for i, page in enumerate(doc):
                text = page.get_text().strip()
                if text:
                    pages.append({
                        "page_number": i + 1,
                        "text": self.clean_text(text),
                    })
            doc.close()
            return pages
        except Exception as e:
            logger.error(f"PDF page extraction error: {e}")
            raise e

    def clean_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        text = re.sub(r'\s+', ' ', text)
        text = text.replace('\x00', '')
        lines = text.split('\n')
        cleaned_lines = [line.strip() for line in lines if len(line.strip()) > 5]
        return '\n'.join(cleaned_lines) if cleaned_lines else text.strip()

    def split_into_chunks(
        self,
        text: str,
        chunk_size: int = None,
        chunk_overlap: int = None
    ) -> List[str]:
        """Split text into overlapping chunks for vector indexing"""
        chunk_size = chunk_size or self.chunk_size
        chunk_overlap = chunk_overlap or self.chunk_overlap

        if len(text) <= chunk_size:
            chunk = text.strip()
            return [chunk] if chunk else []

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            if end < len(text):
                sentence_end = text.rfind('.', start, end)
                if sentence_end > start + chunk_size // 2:
                    end = sentence_end + 1
                else:
                    word_end = text.rfind(' ', start, end)
                    if word_end > start:
                        end = word_end

            chunk = text[start:end].strip()
            if chunk and len(chunk) > 20:
                chunks.append(chunk)

            start = end - chunk_overlap
            if start >= len(text):
                break

        return chunks

    def extract_metadata(self, file_path: str) -> dict:
        """Extract metadata from PDF using PyMuPDF"""
        try:
            doc = fitz.open(file_path)
            metadata = doc.metadata or {}
            metadata['page_count'] = len(doc)
            doc.close()
            return metadata
        except Exception as e:
            logger.error(f"Metadata extraction error: {e}")
            return {}

    def get_page_text(self, file_path: str, page_number: int) -> str:
        """Extract text from specific page"""
        try:
            doc = fitz.open(file_path)
            if page_number < 0 or page_number >= len(doc):
                raise ValueError(f"Page {page_number} not found")
            text = doc[page_number].get_text()
            doc.close()
            return self.clean_text(text)
        except Exception as e:
            logger.error(f"Page extraction error: {e}")
            raise e