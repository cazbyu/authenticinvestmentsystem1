export const privacyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Authentic Intelligence Labs</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9fafb;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        h1 {
            color: #1e293b;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .company-name {
            color: #2563eb;
            font-size: 1.2em;
            font-weight: 600;
        }

        .last-updated {
            color: #64748b;
            font-style: italic;
            margin-top: 10px;
        }

        h2 {
            color: #1e293b;
            font-size: 1.8em;
            margin-top: 40px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
        }

        h3 {
            color: #334155;
            font-size: 1.3em;
            margin-top: 25px;
            margin-bottom: 10px;
        }

        p {
            margin-bottom: 15px;
            text-align: justify;
        }

        ul, ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }

        li {
            margin-bottom: 8px;
        }

        .important-notice {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
        }

        .contact-info {
            background-color: #f1f5f9;
            padding: 20px;
            border-radius: 6px;
            margin-top: 30px;
        }

        .contact-info h3 {
            margin-top: 0;
        }

        a {
            color: #2563eb;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 2em;
            }
            h2 {
                font-size: 1.5em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Privacy Policy</h1>
            <div class="company-name">Authentic Intelligence Labs</div>
            <p class="last-updated">Last Updated: January 10, 2025</p>
        </header>

        <section>
            <h2>1. Introduction</h2>
            <p>
                Salt City Digital Design ("we," "our," or "us") operates the Authentic Intelligence Labs mobile application (the "App"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our App.
            </p>
            <p>
                We are committed to protecting your privacy and ensuring transparency about our data practices. By using the App, you agree to the collection and use of information in accordance with this policy.
            </p>
            <div class="important-notice">
                <strong>Important:</strong> If you do not agree with this Privacy Policy, please do not use the App. Your continued use of the App constitutes your acceptance of this Privacy Policy and any updates.
            </div>
        </section>

        <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide Directly</h3>
            <p>When you create an account or use the App, we collect the following information:</p>
            <ul>
                <li><strong>Account Information:</strong> Name, email address, and profile information obtained through Google OAuth authentication</li>
                <li><strong>Profile Data:</strong> First name, last name, and optional profile picture</li>
                <li><strong>User-Generated Content:</strong> Goals, tasks, wellness data, relationship information, journal entries, daily notes, reflections, and any other content you choose to input into the App</li>
                <li><strong>Photos and Images:</strong> Images you upload for key relationships or deposit ideas</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <p>We may automatically collect certain information when you use the App:</p>
            <ul>
                <li><strong>Usage Data:</strong> Information about how you interact with the App, including features used, timestamps, and session duration</li>
                <li><strong>Device Information:</strong> Device type, operating system version, unique device identifiers, and mobile network information</li>
                <li><strong>Log Data:</strong> Error logs, diagnostic information, and performance data</li>
            </ul>

            <h3>2.3 Third-Party Information</h3>
            <p>When you authenticate using Google OAuth, we receive:</p>
            <ul>
                <li>Your Google account email address</li>
                <li>Your name as registered with Google</li>
                <li>Your Google profile picture (if available)</li>
            </ul>
        </section>

        <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the collected information for the following purposes:</p>
            <ul>
                <li><strong>Provide and Maintain the Service:</strong> To create and manage your account, authenticate your identity, and provide core App functionality</li>
                <li><strong>Personalization:</strong> To personalize your experience, display your goals, track your progress, and provide customized content</li>
                <li><strong>Communication:</strong> To send you service-related notifications, updates, and respond to your inquiries</li>
                <li><strong>Improvement and Development:</strong> To analyze usage patterns, diagnose technical issues, and improve the App's features and performance</li>
                <li><strong>Security:</strong> To detect, prevent, and address fraud, abuse, security incidents, and other harmful activities</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, legal processes, and enforceable governmental requests</li>
            </ul>
        </section>

        <section>
            <h2>4. Data Storage and Security</h2>

            <h3>4.1 Where Your Data is Stored</h3>
            <p>
                Your data is stored using Supabase, which utilizes PostgreSQL databases hosted on Amazon Web Services (AWS) infrastructure. Data storage location is primarily in AWS data centers.
            </p>

            <h3>4.2 Security Measures</h3>
            <p>We implement industry-standard security measures to protect your information:</p>
            <ul>
                <li><strong>Encryption:</strong> All data is encrypted in transit using TLS/SSL protocols and at rest using AES-256 encryption</li>
                <li><strong>Authentication:</strong> We use OAuth 2.0 for secure authentication via Google</li>
                <li><strong>Access Controls:</strong> Strict access controls ensure that only authorized personnel can access user data for legitimate purposes</li>
                <li><strong>Regular Security Audits:</strong> We conduct regular security assessments and updates to our infrastructure</li>
            </ul>
            <p>
                While we strive to protect your personal information, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security of your data.
            </p>
        </section>

        <section>
            <h2>5. Third-Party Services</h2>
            <p>The App integrates with the following third-party services:</p>

            <h3>5.1 Google OAuth</h3>
            <p>
                We use Google OAuth for authentication. When you sign in with Google, you are subject to Google's Privacy Policy. We only receive the information you authorize Google to share with us (email, name, and profile picture).
            </p>

            <h3>5.2 Supabase</h3>
            <p>
                Our backend infrastructure is powered by Supabase. Supabase acts as our data processor and is contractually obligated to protect your data.
            </p>
        </section>

        <section>
            <h2>6. Data Sharing and Disclosure</h2>
            <p>We do not sell, rent, or trade your personal information to third parties. We may share your information only in the following circumstances:</p>
            <ul>
                <li><strong>Service Providers:</strong> With trusted service providers (such as Supabase and AWS) who assist in operating the App, subject to confidentiality obligations</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
                <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of Salt City Digital Design, our users, or the public</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity</li>
                <li><strong>With Your Consent:</strong> With your explicit consent for any other purpose</li>
            </ul>
        </section>

        <section>
            <h2>7. Your Rights and Choices</h2>

            <h3>7.1 Access and Correction</h3>
            <p>You have the right to access and update your personal information at any time through the App's settings.</p>

            <h3>7.2 Data Deletion</h3>
            <p>
                You can request deletion of your account and associated data by contacting us at the email address provided below. Upon request, we will delete your personal information within 30 days, except where retention is required by law or for legitimate business purposes.
            </p>

            <h3>7.3 Data Portability</h3>
            <p>
                You have the right to request a copy of your data in a structured, commonly used, and machine-readable format. Contact us to request data export.
            </p>
        </section>

        <section>
            <h2>8. Children's Privacy</h2>
            <p>
                The App is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information promptly.
            </p>
            <p>
                If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
            </p>
        </section>

        <section>
            <h2>9. Changes to This Privacy Policy</h2>
            <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make changes, we will update the "Last Updated" date at the top of this policy.
            </p>
            <p>
                For material changes, we will provide notice through the App or via email. Your continued use of the App after such notice constitutes your acceptance of the updated Privacy Policy.
            </p>
        </section>

        <section class="contact-info">
            <h2>10. Contact Us</h2>
            <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <p>
                <strong>Salt City Digital Design</strong><br>
                1428 E Granada Dr<br>
                Sandy, Utah 84093<br>
                United States
            </p>
            <p>
                <strong>Email:</strong> <a href="mailto:privacy@authenticintelligencelabs.com">privacy@authenticintelligencelabs.com</a>
            </p>
            <p>
                We will respond to your inquiries within 30 days.
            </p>
        </section>

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9em;">
            <p>&copy; 2025 Salt City Digital Design. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
