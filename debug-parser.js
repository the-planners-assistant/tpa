#!/usr/bin/env node

// Debug the PolicyParser step by step
import { PolicyParser } from './packages/core/src/policy-parser.js';
import fs from 'fs';

console.log('🔍 Step-by-step PolicyParser Debug\n');

async function debugParser() {
    const parser = new PolicyParser();
    const htmlBuffer = fs.readFileSync('./test-local-plan.html');
    
    console.log('1. Extracting text...');
    const text = await parser._extractText(htmlBuffer, null, 'test-local-plan.html');
    console.log(`   Text length: ${text.length}`);
    console.log(`   Sample: ${text.substring(0, 300)}...\n`);
    
    console.log('2. Analyzing structure...');
    const structure = await parser._analyzeStructure(text, 'test-local-plan.html');
    console.log(`   Title: ${structure.title}`);
    console.log(`   Sections: ${structure.sections.length}`);
    structure.sections.forEach((section, i) => {
        console.log(`   Section ${i+1}: ${section.title} (content length: ${section.content.length})`);
        if (Array.isArray(section.content)) {
            console.log(`     Content sample: ${section.content.slice(0, 3).join(' ').substring(0, 100)}...`);
        } else {
            console.log(`     Content sample: ${section.content.substring(0, 100)}...`);
        }
    });
    
    // Debug section identification
    console.log('\n   Testing section patterns in text:');
    const lines = text.split('\n');
    lines.slice(0, 10).forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
            const sectionHeader = parser._identifySection(trimmed, i);
            console.log(`   Line ${i}: "${trimmed.substring(0, 50)}..." -> ${sectionHeader ? `${sectionHeader.type}: ${sectionHeader.reference}` : 'no match'}`);
        }
    });
    console.log('');
    
    console.log('3. Extracting policies...');
    const policies = await parser._extractPolicies(structure);
    console.log(`   Policies found: ${policies.length}`);
    policies.forEach((policy, i) => {
        console.log(`   Policy ${i+1}: ${policy.policyId} - ${policy.title}`);
        console.log(`     Category: ${policy.category}`);
        console.log(`     Content length: ${policy.content.length}`);
    });
    
    if (policies.length === 0) {
        console.log('\n🔍 Debugging policy extraction failure...');
        console.log('Checking text for policy patterns:');
        
        // Test specific patterns
        const policyMatches = text.match(/Policy\s+[A-Z]\d+:/gi);
        console.log(`   "Policy X#:" matches: ${policyMatches ? policyMatches.length : 0}`);
        if (policyMatches) {
            console.log(`   Found: ${policyMatches.join(', ')}`);
        }
        
        const sectionMatches = text.match(/^\d+\.\s+[A-Z]/gmi);
        console.log(`   Numbered sections: ${sectionMatches ? sectionMatches.length : 0}`);
        if (sectionMatches) {
            console.log(`   Found: ${sectionMatches.slice(0, 3).join(', ')}`);
        }
    }
}

debugParser().catch(console.error);
