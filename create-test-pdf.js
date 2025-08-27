#!/usr/bin/env node

// Simple script to create a test PDF with sample policy content
import fs from 'fs';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Local Plan Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2563eb; }
        h2 { color: #059669; margin-top: 30px; }
        .policy { background: #f3f4f6; padding: 15px; margin: 10px 0; border-left: 4px solid #2563eb; }
        .requirement { margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Anytown Local Plan 2024-2040</h1>
    
    <h2>1. Introduction</h2>
    <p>This Local Plan sets out the planning framework for Anytown Borough for the period 2024-2040.</p>
    
    <h2>2. Housing Policies</h2>
    
    <div class="policy">
        <h3>Policy H1: Housing Provision</h3>
        <p>The Local Plan will provide for a minimum of 15,000 new homes over the plan period.</p>
        <div class="requirement">Requirements:</div>
        <ul>
            <li>At least 30% affordable housing on sites of 10+ units</li>
            <li>Mix of housing types and tenures</li>
            <li>Compliance with national space standards</li>
        </ul>
        <p>Cross-reference: See Policy H2 for affordable housing details and Policy T1 for transport requirements.</p>
    </div>
    
    <div class="policy">
        <h3>Policy H2: Affordable Housing</h3>
        <p>All residential developments of 10 or more units must provide 30% affordable housing.</p>
        <div class="requirement">Requirements:</div>
        <ul>
            <li>70% social rent, 30% intermediate housing</li>
            <li>On-site provision preferred</li>
            <li>Financial contributions where on-site not viable</li>
        </ul>
        <p>Cross-reference: Links to Policy H1 and Local Housing Needs Assessment.</p>
    </div>
    
    <h2>3. Employment Policies</h2>
    
    <div class="policy">
        <h3>Policy E1: Employment Land</h3>
        <p>The plan allocates 50 hectares of employment land to support economic growth.</p>
        <div class="requirement">Requirements:</div>
        <ul>
            <li>B1, B2, and B8 use classes permitted</li>
            <li>High-quality design standards</li>
            <li>Good transport connections</li>
        </ul>
        <p>Cross-reference: See Transport Policy T2 for access requirements.</p>
    </div>
    
    <h2>4. Transport Policies</h2>
    
    <div class="policy">
        <h3>Policy T1: Sustainable Transport</h3>
        <p>All new developments must promote sustainable transport modes.</p>
        <div class="requirement">Requirements:</div>
        <ul>
            <li>Travel plans for developments over 50 units</li>
            <li>Cycle parking provision</li>
            <li>Electric vehicle charging points</li>
        </ul>
    </div>
    
    <h2>5. Implementation and Monitoring</h2>
    <p>This plan will be monitored annually through the Authority Monitoring Report.</p>
    
</body>
</html>
`;

// Write HTML file
fs.writeFileSync('test-local-plan.html', htmlContent);
console.log('✅ Created test-local-plan.html');
console.log('📄 Contains 4 policies across housing, employment, and transport categories');
console.log('🔗 Includes cross-references between policies');
console.log('📋 Contains requirements and structured content');

console.log('\n📖 To test with this file:');
console.log('1. Upload test-local-plan.html to the policy upload interface');
console.log('2. Or test programmatically with the PolicyParser');

console.log('\n💡 For PDF testing:');
console.log('You can print this HTML file to PDF from your browser or use a tool like wkhtmltopdf');
