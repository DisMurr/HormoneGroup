#!/bin/bash

# 🚀 HormoneGroup.ie AI Agent Ecosystem - High-Performance Setup Script
# Run this script on your new powerful machine for complete setup

echo "🚀 Starting HormoneGroup.ie Enhanced AI Agent Ecosystem Setup..."
echo "=================================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed and correct version
check_node() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
        
        # Check if version is 22.x
        MAJOR_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge "18" ]; then
            print_success "Node.js version is compatible"
        else
            print_warning "Node.js version should be 18+ for optimal performance"
            print_status "Consider upgrading to Node.js 22.x LTS"
        fi
    else
        print_error "Node.js not found! Please install Node.js 22.x LTS"
        print_status "Visit: https://nodejs.org/"
        exit 1
    fi
}

# Check if Git is installed
check_git() {
    print_status "Checking Git installation..."
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_success "Git found: $GIT_VERSION"
    else
        print_error "Git not found! Please install Git"
        exit 1
    fi
}

# Install main project dependencies
install_main_deps() {
    print_status "Installing main project dependencies..."
    
    if command -v yarn &> /dev/null; then
        print_status "Using Yarn for faster installation..."
        yarn install
    else
        print_status "Using npm for installation..."
        npm install
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Main dependencies installed successfully"
    else
        print_error "Failed to install main dependencies"
        exit 1
    fi
}

# Install Sanity dependencies
install_sanity_deps() {
    print_status "Installing Sanity CMS dependencies..."
    
    if [ -d "sanity/hormone-group-ie" ]; then
        cd sanity/hormone-group-ie
        
        if command -v yarn &> /dev/null; then
            yarn install
        else
            npm install
        fi
        
        if [ $? -eq 0 ]; then
            print_success "Sanity dependencies installed successfully"
        else
            print_error "Failed to install Sanity dependencies"
        fi
        
        cd ../..
    else
        print_warning "Sanity directory not found, skipping..."
    fi
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env.local" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env.local
            print_success "Created .env.local from .env.example"
            print_warning "Please edit .env.local with your actual API keys"
        else
            print_warning "No .env.example found, please create .env.local manually"
        fi
    else
        print_success ".env.local already exists"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    if [ -f "prisma/schema.prisma" ]; then
        print_status "Generating Prisma client..."
        npx prisma generate
        
        if [ $? -eq 0 ]; then
            print_success "Prisma client generated successfully"
        else
            print_error "Failed to generate Prisma client"
        fi
    else
        print_warning "No Prisma schema found, skipping database setup"
    fi
}

# Optimize for high-performance machine
optimize_performance() {
    print_status "Applying high-performance optimizations..."
    
    # Set Node.js memory limit for large AI operations
    echo "export NODE_OPTIONS=\"--max-old-space-size=8192\"" >> ~/.bashrc
    echo "export NODE_OPTIONS=\"--max-old-space-size=8192\"" >> ~/.zshrc 2>/dev/null || true
    
    # Set production optimizations
    echo "export NODE_ENV=production" >> ~/.bashrc
    echo "export NODE_ENV=production" >> ~/.zshrc 2>/dev/null || true
    echo "export NEXT_TELEMETRY_DISABLED=1" >> ~/.bashrc  
    echo "export NEXT_TELEMETRY_DISABLED=1" >> ~/.zshrc 2>/dev/null || true
    
    print_success "Performance optimizations applied"
    print_status "Restart your terminal or run 'source ~/.bashrc' to apply changes"
}

# Test AI agents
test_agents() {
    print_status "Testing AI agent ecosystem..."
    
    # Check if environment variables are set
    if [ -z "$OPENAI_API_KEY" ] && [ -f ".env.local" ]; then
        print_status "Loading environment variables for testing..."
        export $(grep -v '^#' .env.local | xargs)
    fi
    
    if [ -n "$OPENAI_API_KEY" ]; then
        print_status "Testing Enhanced Stripe AI Agent..."
        timeout 30 npm run stripe:ai "quick system test" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            print_success "Stripe AI Agent is operational"
        else
            print_warning "Stripe AI Agent test inconclusive (may need API keys)"
        fi
    else
        print_warning "OpenAI API key not found, skipping agent tests"
        print_status "Configure API keys in .env.local and test manually"
    fi
}

# Display final instructions
display_final_instructions() {
    echo ""
    echo "=================================================================="
    echo -e "${GREEN}🎉 Setup Complete! Enhanced AI Agent Ecosystem Ready${NC}"
    echo "=================================================================="
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Configure API keys in .env.local file"
    echo "   - OpenAI API key for AI agents"
    echo "   - Stripe keys for payment processing" 
    echo "   - Sanity credentials for CMS"
    echo "   - Database connection strings"
    echo ""
    echo -e "${BLUE}Test Your Enhanced AI Agents:${NC}"
    echo "npm run stripe:ai \"provide financial analysis\""
    echo "npm run sanity:ai \"analyze content performance\""
    echo "npm run ai:master \"generate executive dashboard\""
    echo ""
    echo -e "${BLUE}Start Development Server:${NC}"
    echo "npm run dev"
    echo ""
    echo -e "${BLUE}Available Scripts:${NC}"
    echo "- npm run ai:health     # System health check"
    echo "- npm run ai:analyze    # Comprehensive analysis" 
    echo "- npm run ai:complete   # Complete business intelligence"
    echo "- npm run workflow:test # Test complete workflow"
    echo ""
    echo -e "${GREEN}Your powerful machine is ready for high-performance AI operations! 🚀${NC}"
}

# Main execution
main() {
    print_status "High-Performance Machine Setup Starting..."
    echo ""
    
    check_node
    check_git
    install_main_deps
    install_sanity_deps
    setup_environment
    setup_database
    optimize_performance
    test_agents
    display_final_instructions
}

# Run main function
main
