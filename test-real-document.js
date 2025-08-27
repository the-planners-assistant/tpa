#!/usr/bin/env node

// Test the PolicyParser with the created HTML file
import { PolicyParser } from './packages/core/src/policy-parser.js';
import fs from 'fs';

console.log('🧪 Testing PolicyParser with Real Document\n');

async function testWithHtmlFile() {
    try {
        const parser = new PolicyParser();
        
        // Read the HTML file as buffer
        const htmlBuffer = fs.readFileSync('./test-local-plan.html');
        console.log(`📄 Reading test-local-plan.html (${htmlBuffer.length} bytes)`);
        
        // Parse the HTML document
        console.log('\n🔍 Parsing HTML document...');
        const result = await parser.parseDocument(htmlBuffer, 'test-local-plan.html');
        
        console.log('\n📊 Parsing Results:');
        console.log(`   • Parsing successful: ${result ? 'Yes' : 'No'}`);
        
        if (!result) {
            console.log('❌ No result returned from parser');
            return;
        }
        
        console.log(`   • Total policies found: ${result.policies ? result.policies.length : 'undefined'}`);
        console.log(`   • Categories found: ${result.policies ? [...new Set(result.policies.map(p => p.category))].join(', ') : 'undefined'}`);
        console.log(`   • Structure: ${result.structure ? 'Present' : 'Missing'}`);
        
        if (result.structure) {
            console.log(`   • Total sections: ${result.structure.sections ? result.structure.sections.length : 'undefined'}`);
        }
        
        if (result.metadata) {
            console.log(`   • Word count: ${result.metadata.wordCount}`);
        }
        
        if (!result.policies || result.policies.length === 0) {
            console.log('\n⚠ No policies found. Let me debug the parsing process...');
            
            // Debug: Check if text extraction worked
            const parser2 = new PolicyParser();
            const extractedText = await parser2._extractText(htmlBuffer, null, 'test-local-plan.html');
            console.log(`📄 Extracted text length: ${extractedText ? extractedText.length : 'null'}`);
            console.log(`📄 First 200 chars: ${extractedText ? extractedText.substring(0, 200) + '...' : 'null'}`);
            
            return;
        }
        
        console.log('\n📋 Individual Policies:');
        result.policies.forEach((policy, index) => {
            console.log(`   ${index + 1}. ${policy.policyId}: ${policy.title}`);
            console.log(`      Category: ${policy.category}`);
            console.log(`      Content: ${policy.content.substring(0, 100)}...`);
            console.log(`      Requirements: ${policy.requirements.length}`);
            console.log(`      Cross-refs: ${policy.crossReferences.length}`);
            if (policy.crossReferences.length > 0) {
                console.log(`      References: ${policy.crossReferences.join(', ')}`);
            }
            console.log('');
        });
        
        console.log('📈 Summary:');
        console.log(`   • Housing policies: ${result.policies.filter(p => p.category === 'housing').length}`);
        console.log(`   • Employment policies: ${result.policies.filter(p => p.category === 'employment').length}`);
        console.log(`   • Transport policies: ${result.policies.filter(p => p.category === 'transport').length}`);
        console.log(`   • Policies with requirements: ${result.policies.filter(p => p.requirements.length > 0).length}`);
        console.log(`   • Policies with cross-refs: ${result.policies.filter(p => p.crossReferences.length > 0).length}`);
        
        console.log('\n✅ HTML parsing test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testWithHtmlFile();
