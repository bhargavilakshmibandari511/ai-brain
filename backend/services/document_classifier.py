"""
Document Classification Module using Machine Learning (TF-IDF + Logistic Regression).

Workflow:
  1. Text vectorization using TF-IDF (Term FrequencyInverse Document Frequency)
  2. Classification using Logistic Regression
  3. Returns predicted category + confidence score

Categories: Research, Technical, News, Blog, Legal, Financial, Educational, General
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import numpy as np


# Pre-built training dataset for document classification
TRAINING_DATA = [
    # Research
    ("Deep learning model for medical image diagnosis and classification", "Research"),
    ("A novel approach to neural network optimization using gradient descent", "Research"),
    ("Quantum computing algorithms for cryptographic applications", "Research"),
    ("Machine learning techniques for natural language processing tasks", "Research"),
    ("Statistical analysis of gene expression data in cancer research", "Research"),
    ("Convolutional neural networks for object detection and recognition", "Research"),
    ("Reinforcement learning for autonomous robot navigation systems", "Research"),
    ("A survey of transfer learning methods in computer vision", "Research"),
    ("Bayesian inference methods for probabilistic modeling", "Research"),
    ("Experimental results demonstrate significant improvement in accuracy", "Research"),
    ("We propose a novel framework for multi-task learning", "Research"),
    ("Abstract: This paper presents a new methodology for data analysis", "Research"),
    ("The experimental evaluation shows the effectiveness of our approach", "Research"),
    ("Related work in the field of artificial intelligence and deep learning", "Research"),
    ("Our findings suggest a correlation between the variables studied", "Research"),

    # Technical
    ("Python programming tutorial for beginners with examples", "Technical"),
    ("How to build a REST API using FastAPI and Python", "Technical"),
    ("Docker containerization guide for microservices architecture", "Technical"),
    ("JavaScript ES6 features and modern web development practices", "Technical"),
    ("Database optimization techniques for SQL and NoSQL systems", "Technical"),
    ("Git version control workflow and branching strategies", "Technical"),
    ("Setting up CI/CD pipelines with GitHub Actions", "Technical"),
    ("React component lifecycle and state management patterns", "Technical"),
    ("System design patterns for scalable cloud applications", "Technical"),
    ("API documentation and endpoint reference guide", "Technical"),
    ("Installation guide and configuration instructions for the software", "Technical"),
    ("Debugging tips and troubleshooting common errors in production", "Technical"),
    ("Code review best practices and coding standards", "Technical"),
    ("Implementation details and technical specifications", "Technical"),
    ("Architecture overview and system design documentation", "Technical"),

    # News
    ("Breaking news: election results announced in national polls", "News"),
    ("Stock market crashes amid global economic uncertainty", "News"),
    ("New government policy on climate change and emissions", "News"),
    ("Sports update: cricket world cup final match highlights", "News"),
    ("Technology company announces major acquisition deal", "News"),
    ("International summit discusses global security concerns", "News"),
    ("Weather forecast predicts severe storms this weekend", "News"),
    ("Celebrity controversy sparks social media debate", "News"),
    ("Local community protests against new construction project", "News"),
    ("Economic report shows GDP growth in the third quarter", "News"),
    ("Press release: company reports quarterly earnings", "News"),
    ("Political debate highlights key policy disagreements", "News"),
    ("Latest developments in the ongoing conflict situation", "News"),
    ("Health authorities warn about new virus outbreak", "News"),
    ("Transportation infrastructure update and road closures", "News"),

    # Blog
    ("10 tips for a healthy lifestyle and better sleep habits", "Blog"),
    ("My personal journey of learning to code from scratch", "Blog"),
    ("Best travel destinations for summer vacation 2024", "Blog"),
    ("Review of the latest smartphone features and camera quality", "Blog"),
    ("How I improved my productivity with these simple habits", "Blog"),
    ("Top 5 recipes for quick and easy weeknight dinners", "Blog"),
    ("A beginners guide to meditation and mindfulness", "Blog"),
    ("My experience working remotely during the pandemic", "Blog"),
    ("Book review and personal recommendations for fiction lovers", "Blog"),
    ("Fitness journey update and workout routine changes", "Blog"),
    ("Personal finance tips for saving money effectively", "Blog"),
    ("Home improvement ideas on a budget for small spaces", "Blog"),
    ("My thoughts on the latest movie and entertainment trends", "Blog"),
    ("Life lessons learned from traveling around the world", "Blog"),
    ("DIY craft ideas and creative projects for weekends", "Blog"),

    # Legal
    ("Terms and conditions of service agreement for platform usage", "Legal"),
    ("Privacy policy regarding collection and use of personal data", "Legal"),
    ("Contract agreement between parties for service delivery", "Legal"),
    ("Intellectual property rights and copyright protection notice", "Legal"),
    ("Legal compliance requirements under GDPR regulations", "Legal"),
    ("Non-disclosure agreement for confidential information", "Legal"),
    ("Liability clause and limitation of damages in agreements", "Legal"),
    ("Employment contract terms including compensation details", "Legal"),
    ("Dispute resolution procedures and arbitration clauses", "Legal"),
    ("Software license agreement and permitted usage terms", "Legal"),
    ("Regulatory compliance documentation and audit requirements", "Legal"),
    ("Hereby agree to the following terms and obligations", "Legal"),
    ("Shall indemnify and hold harmless the party against claims", "Legal"),
    ("Subject to applicable laws and jurisdictional requirements", "Legal"),
    ("The parties agree to binding arbitration for dispute resolution", "Legal"),

    # Financial
    ("Annual financial report and balance sheet statement", "Financial"),
    ("Investment portfolio analysis and risk assessment", "Financial"),
    ("Quarterly revenue and profit margin breakdown", "Financial"),
    ("Tax filing guidelines and deduction documentation", "Financial"),
    ("Budget allocation and expense tracking summary", "Financial"),
    ("Audit report findings and financial compliance status", "Financial"),
    ("Cash flow analysis and working capital management", "Financial"),
    ("Stock performance and dividend payout history", "Financial"),
    ("Business valuation and merger acquisition analysis", "Financial"),
    ("Financial projections and forecasting for next fiscal year", "Financial"),
    ("Income statement and operating expense details", "Financial"),
    ("Return on investment and profitability metrics", "Financial"),
    ("Total assets and liabilities reported for the period", "Financial"),
    ("Depreciation schedule and amortization of intangible assets", "Financial"),
    ("Cost benefit analysis for the proposed project", "Financial"),

    # Educational
    ("Introduction to calculus and differential equations course notes", "Educational"),
    ("History of world civilizations and ancient societies", "Educational"),
    ("Biology lecture notes on cell structure and DNA replication", "Educational"),
    ("Physics fundamentals including mechanics and thermodynamics", "Educational"),
    ("English literature analysis of Shakespeare and modern poetry", "Educational"),
    ("Chemistry lab manual and experimental procedures", "Educational"),
    ("Mathematics problem sets and practice exercises", "Educational"),
    ("Geography notes on climate zones and world ecosystems", "Educational"),
    ("Economics principles of supply demand and market equilibrium", "Educational"),
    ("Study guide and exam preparation materials for students", "Educational"),
    ("Curriculum overview and learning objectives for the course", "Educational"),
    ("Textbook chapter summary and key concepts review", "Educational"),
    ("Assignment instructions and grading rubric", "Educational"),
    ("Syllabus for the semester including reading list", "Educational"),
    ("Lecture slides covering fundamental principles and theories", "Educational"),

    # General
    ("Meeting minutes and notes from team discussion", "General"),
    ("Project status update and milestone tracking", "General"),
    ("Weekly report summarizing activities and progress", "General"),
    ("Agenda for the upcoming planning session", "General"),
    ("Miscellaneous notes and random information collection", "General"),
    ("Contact information and directory listing", "General"),
    ("Event invitation and schedule details", "General"),
    ("Feedback form responses and survey results", "General"),
    ("Internal memo regarding office policy updates", "General"),
    ("Task list and project management documentation", "General"),
    ("Company newsletter and organizational announcements", "General"),
    ("Thank you note and acknowledgment letter", "General"),
    ("Reference materials and resource links compilation", "General"),
    ("General correspondence and communication records", "General"),
    ("Frequently asked questions and support information", "General"),
]

# All categories
CATEGORIES = ["Research", "Technical", "News", "Blog", "Legal", "Financial", "Educational", "General"]


class DocumentClassifier:
    """ML-based document classifier using TF-IDF + Logistic Regression."""

    def __init__(self):
        self.pipeline: Pipeline | None = None
        self.is_trained = False

    def train(self):
        """Train the classifier on the built-in training dataset."""
        texts = [t for t, _ in TRAINING_DATA]
        labels = [l for _, l in TRAINING_DATA]

        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                stop_words="english",
                sublinear_tf=True,
            )),
            ("clf", LogisticRegression(
                max_iter=1000,
                solver="lbfgs",
                C=1.0,
            )),
        ])

        self.pipeline.fit(texts, labels)
        self.is_trained = True
        print(" Document Classifier: Trained successfully")

    def classify(self, text: str) -> dict:
        """
        Classify a document's text and return the predicted category + confidence.

        Returns:
            {
                "category": "Research",
                "confidence": 0.92,
                "all_scores": {"Research": 0.92, "Technical": 0.04, ...}
            }
        """
        if not self.is_trained or self.pipeline is None:
            self.train()

        # Use first 6000 chars for classification (enough to capture topic)
        sample = text[:6000]

        predicted = self.pipeline.predict([sample])[0]
        probabilities = self.pipeline.predict_proba([sample])[0]
        classes = self.pipeline.classes_

        all_scores = {
            cls: round(float(prob), 4)
            for cls, prob in zip(classes, probabilities)
        }

        confidence = round(float(max(probabilities)), 4)

        return {
            "category": predicted,
            "confidence": confidence,
            "all_scores": all_scores,
        }


# Singleton instance
classifier = DocumentClassifier()
