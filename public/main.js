// Enhanced main.js - Complete VintedTrends Dashboard
class VintedDashboard {
  constructor() {
    this.salesContainer = document.getElementById("salesContainer");
    this.loadingState = document.getElementById("loadingState");
    this.searchBar = document.getElementById("searchBar");
    this.sortOptions = document.getElementById("sortOptions");
    this.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    this.statsDisplay = document.getElementById("statsDisplay");
    
    // State
    this.allSales = [];
    this.currentSort = 'newest';
    this.searchQuery = '';
    this.currentFilters = { brand: [], color: [], size: [] };
    this.lastUpdateTime = null;
    
    this.init();
  }

  // Helper Functions
  getSaleSpeed(item) {
    if (item.startedAt && item.soldAt) {
      const startTime = new Date(item.startedAt);
      const soldTime = new Date(item.soldAt);
      const diffMs = soldTime - startTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      return `${diffMins}m ${diffSecs}s`;
    }
    if (typeof item.speed === 'number') {
      const totalSeconds = Math.floor(item.speed);
      const diffMins = Math.floor(totalSeconds / 60);
      const diffSecs = totalSeconds % 60;
      return `${diffMins}m ${diffSecs}s`;
    }
    return null;
  }

  getSaleDurationInMs(item) {
    return (item.startedAt && item.soldAt) 
      ? new Date(item.soldAt) - new Date(item.startedAt) 
      : Infinity;
  }

  extractSize(subtitle) {
    return subtitle ? (subtitle.split('·')[0].trim().toUpperCase() || null) : null;
  }

// This is the CORRECT new code
extractBrand(item) {
  if (!item.name) {
    return null;
  }
  // The brand is assumed to be the first word of the item's name.
  return item.name.split(' ')[0];
}

  mapColorNameToHex(colorName) {
    if (!colorName) return null;
    const firstColor = colorName.split(',')[0].trim().toLowerCase();
    const colorMap = {
        'black': '#000000', 'white': '#FFFFFF', 'grey': '#808080',
        'gray': '#808080', 'silver': '#C0C0C0', 'red': '#FF0000',
        'maroon': '#800000', 'orange': '#FFA500', 'yellow': '#FFFF00',
        'olive': '#808000', 'lime': '#00FF00', 'green': '#008000',
        'aqua': '#00FFFF', 'cyan': '#00FFFF', 'teal': '#008080',
        'blue': '#0000FF', 'navy': '#000080', 'fuchsia': '#FF00FF',
        'magenta': '#FF00FF', 'purple': '#800080', 'pink': '#FFC0CB',
        'brown': '#A52A2A', 'beige': '#F5F5DC', 'khaki': '#F0E68C',
        'gold': '#FFD700', 'cream': '#FFFDD0', 'burgundy': '#800020',
        'mustard': '#FFDB58', 'turquoise': '#40E0D0', 'indigo': '#4B0082',
        'violet': '#EE82EE', 'plum': '#DDA0DD', 'orchid': '#DA70D6',
        'salmon': '#FA8072', 'coral': '#FF7F50', 'chocolate': '#D2691E',
        'tan': '#D2B48C', 'ivory': '#FFFFF0', 'honeydew': '#F0FFF0',
        'azure': '#F0FFFF', 'lavender': '#E6E6FA', 'rose': '#FFE4E1',
        'lilac': '#C8A2C8', 'mint': '#98FF98', 'peach': '#FFDAB9',
        'sky blue': '#87CEEB', 'royal blue': '#4169E1', 'cobalt': '#0047AB',
        'denim': '#1560BD', 'emerald': '#50C878', 'mint green': '#98FF98',
        'lime green': '#32CD32', 'forest green': '#228B22', 'olive green': '#6B8E23',
        'mustard yellow': '#FFDB58', 'lemon': '#FFFACD', 'coral pink': '#F88379',
        'hot pink': '#FF69B4', 'baby pink': '#F4C2C2', 'ruby': '#E0115F',
        'scarlet': '#FF2400', 'wine': '#722F37', 'terracotta': '#E2725B',
        'bronze': '#CD7F32', 'light blue': '#ADD8E6', 'dark green': '#006400', 
        'light grey': '#D3D3D3', 'dark blue': '#00008B', 'light green': '#90EE90', 
        'dark grey': '#A9A9A9', 'multicolour': '#CCCCCC', 'check': '#A9A9A9',
        'floral': '#A9A9A9', 'animal print': '#A9A9A9', 'striped': '#A9A9A9',
        'camouflage': '#A9A9A9', 'geometric': '#A9A9A9', 'abstract': '#A9A9A9'
    };
    return colorMap[firstColor] || '#CCCCCC';
  }

  // Stats calculation with enhanced metrics
  updateStats(filteredSales) {
    if (!this.statsDisplay) return;
    
    if (filteredSales.length === 0) {
      this.statsDisplay.textContent = 'No items match filters';
      return;
    }
    
    const validSaleTimes = filteredSales
      .map(item => this.getSaleDurationInMs(item))
      .filter(time => time !== Infinity);
    
    const avgSaleTime = validSaleTimes.length > 0 ? 
      validSaleTimes.reduce((sum, time) => sum + time, 0) / validSaleTimes.length : 0;
    
    const avgSaleTimeFormatted = avgSaleTime > 0 ? 
      `${Math.floor(avgSaleTime / 60000)}m ${Math.floor((avgSaleTime % 60000) / 1000)}s` : 
      'N/A';
    
    // Calculate price stats
    const prices = filteredSales
      .map(item => parseFloat(item.price.replace(/[^0-9.-]+/g, "") || "0"))
      .filter(price => price > 0);
    
    const avgPrice = prices.length > 0 ? 
      (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2) : 0;
    
    // Find fastest sale
    const fastestSale = Math.min(...validSaleTimes);
    const fastestFormatted = fastestSale !== Infinity ? 
      `${Math.floor(fastestSale / 60000)}m ${Math.floor((fastestSale % 60000) / 1000)}s` : 'N/A';
    
    this.statsDisplay.innerHTML = `
      <span class="font-semibold">${filteredSales.length}</span> items • 
      Avg: <span class="font-semibold">${avgSaleTimeFormatted}</span> • 
      Fastest: <span class="font-semibold text-green-600">${fastestFormatted}</span> • 
      Avg Price: <span class="font-semibold">£${avgPrice}</span>
    `;
  }

  // Price range analysis
  getPriceRangeStats(sales) {
    const prices = sales
      .map(item => parseFloat(item.price.replace(/[^0-9.-]+/g, "") || "0"))
      .filter(price => price > 0)
      .sort((a, b) => a - b);
    
    if (prices.length === 0) return null;
    
    return {
      min: prices[0],
      max: prices[prices.length - 1],
      median: prices[Math.floor(prices.length / 2)],
      q1: prices[Math.floor(prices.length * 0.25)],
      q3: prices[Math.floor(prices.length * 0.75)]
    };
  }

  // Show detailed stats modal
  showStatsModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const priceStats = this.getPriceRangeStats(this.allSales);
    const brands = [...new Set(this.allSales.map(item => this.extractBrand(item)).filter(Boolean))];
    const topBrands = brands.slice(0, 10);
    
    const validSaleTimes = this.allSales
      .map(item => this.getSaleDurationInMs(item))
      .filter(time => time !== Infinity);
    
    const fastSales = validSaleTimes.filter(time => time < 300000).length; // Under 5 minutes
    const slowSales = validSaleTimes.filter(time => time > 3600000).length; // Over 1 hour
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold text-gray-900">Sales Analytics</h2>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <h3 class="font-semibold text-lg">Price Analysis</h3>
              ${priceStats ? `
                <div class="bg-gray-50 p-4 rounded">
                  <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>Min Price: <span class="font-semibold">£${priceStats.min}</span></div>
                    <div>Max Price: <span class="font-semibold">£${priceStats.max}</span></div>
                    <div>Median: <span class="font-semibold">£${priceStats.median}</span></div>
                    <div>Q1: <span class="font-semibold">£${priceStats.q1}</span></div>
                  </div>
                </div>
              ` : '<p class="text-gray-500">No price data available</p>'}
            </div>
            
            <div class="space-y-4">
              <h3 class="font-semibold text-lg">Sale Speed</h3>
              <div class="bg-gray-50 p-4 rounded">
                <div class="space-y-2 text-sm">
                  <div>Total Sales: <span class="font-semibold">${this.allSales.length}</span></div>
                  <div>Fast Sales (&lt;5min): <span class="font-semibold text-green-600">${fastSales}</span></div>
                  <div>Slow Sales (&gt;1hr): <span class="font-semibold text-orange-600">${slowSales}</span></div>
                  <div>Success Rate: <span class="font-semibold">${((fastSales / validSaleTimes.length) * 100).toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
            
            <div class="space-y-4 md:col-span-2">
              <h3 class="font-semibold text-lg">Top Brands</h3>
              <div class="bg-gray-50 p-4 rounded">
                <div class="flex flex-wrap gap-2">
                  ${topBrands.map(brand => 
                    `<span class="bg-primary text-white px-3 py-1 rounded-full text-sm">${brand}</span>`
                  ).join('')}
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-6 pt-4 border-t">
            <p class="text-sm text-gray-500">Last updated: ${this.lastUpdateTime ? this.lastUpdateTime.toLocaleString() : 'Never'}</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // Export data functionality
  exportData(format = 'json') {
    const dataStr = format === 'csv' ? this.convertToCSV(this.allSales) : JSON.stringify(this.allSales, null, 2);
    const dataBlob = new Blob([dataStr], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `vinted-sales-${new Date().toISOString().split('T')[0]}.${format}`;
    link.click();
  }

  convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = ['name', 'price', 'color_name', 'size', 'brand', 'sale_speed', 'sold_at', 'link'];
    const rows = data.map(item => {
      const size = this.extractSize(item.subtitle);
      const brand = this.extractBrand(item);
      const saleSpeed = this.getSaleSpeed(item);
      
      return [
        item.name || '',
        item.price || '',
        item.color_name || '',
        size || '',
        brand || '',
        saleSpeed || '',
        item.soldAt || '',
        item.link || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }

  // Rendering Logic
  renderSales() {
    if (this.loadingState) {
      this.loadingState.classList.add('hidden');
    }
    if (this.salesContainer) {
      this.salesContainer.classList.remove('hidden');
    }

    if (!this.allSales || this.allSales.length === 0) {
      this.salesContainer.innerHTML = `
        <div class="col-span-full text-center py-12">
          <h2 class="text-xl font-semibold text-muted-foreground">No sold items recorded yet.</h2>
          <p class="text-muted-foreground">The tracker is running. Sold items will appear here automatically.</p>
        </div>`;
      return;
    }

    // Apply filters
    const filteredSales = this.allSales.filter(item => {
      const query = this.searchQuery.toLowerCase();
      const searchMatch = !query || 
        (item.name && item.name.toLowerCase().includes(query)) || 
        (item.link && item.link.toLowerCase().includes(query)) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query));

      const brand = this.extractBrand(item);
      const size = this.extractSize(item.subtitle);
      const color = item.color_name ? item.color_name.split(',')[0].trim() : null;

      const brandMatch = this.currentFilters.brand.length === 0 || 
        (brand && this.currentFilters.brand.includes(brand));
      const colorMatch = this.currentFilters.color.length === 0 || 
        (color && this.currentFilters.color.includes(color));
      const sizeMatch = this.currentFilters.size.length === 0 || 
        (size && this.currentFilters.size.includes(size));

      return searchMatch && brandMatch && colorMatch && sizeMatch;
    });

    // Apply sorting
    const sortedSales = [...filteredSales].sort((a, b) => {
      switch (this.currentSort) {
        case 'time_asc':
          return this.getSaleDurationInMs(a) - this.getSaleDurationInMs(b);
        case 'price_asc':
          return parseFloat(a.price.replace(/[^0-9.-]+/g, "") || "0") - 
                 parseFloat(b.price.replace(/[^0-9.-]+/g, "") || "0");
        case 'price_desc':
          return parseFloat(b.price.replace(/[^0-9.-]+/g, "") || "0") - 
                 parseFloat(a.price.replace(/[^0-9.-]+/g, "") || "0");
        default: // newest
          return new Date(b.soldAt || 0) - new Date(a.soldAt || 0);
      }
    });

    // Update stats
    this.updateStats(sortedSales);

    if (sortedSales.length === 0) {
      this.salesContainer.innerHTML = 
        `<p class="col-span-full text-center text-muted-foreground py-12">No items match your filters.</p>`;
      return;
    }

    // Render cards
    this.salesContainer.innerHTML = sortedSales.map(item => {
      const saleSpeed = this.getSaleSpeed(item);
      const size = this.extractSize(item.subtitle);
      const colorHex = this.mapColorNameToHex(item.color_name);
      const isWhite = colorHex && colorHex.toUpperCase() === '#FFFFFF';
      const borderClass = isWhite ? 'border border-gray-400' : '';
      
      const soldTimeAgo = (() => {
        if (!item.soldAt) return '';
        const seconds = Math.round((new Date() - new Date(item.soldAt)) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        
        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
      })();

      const colorCircleHTML = colorHex ? 
        `<div class="w-4 h-4 rounded-full ${borderClass}" style="background-color: ${colorHex};" title="${item.color_name || 'Color'}"></div>` : '';
      
      const sizeAndColorHTML = size || colorCircleHTML ? `
        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${size ? `<span class="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">${size}</span>` : ''}
          ${colorCircleHTML}
        </div>
      ` : '';

      return `
        <div class="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block relative group">
            <img src="${item.image || 'https://placehold.co/400x600/f1f5f9/94a3b8?text=Sold'}" 
                 alt="${item.name || 'Sold item'}" 
                 class="w-full h-72 object-cover group-hover:opacity-95 transition-opacity duration-200" 
                 loading="lazy" 
                 onerror="this.src='https://placehold.co/400x600/f1f5f9/94a3b8?text=No+Image'" />
          </a>
          
          <div class="p-3 flex flex-col flex-grow">
            <div class="flex justify-between items-start gap-2 mb-2">
              <p class="font-semibold text-sm line-clamp-2 leading-tight">${item.name || 'Untitled Item'}</p>
              ${sizeAndColorHTML}
            </div>
            
            <div class="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <span class="truncate">${saleSpeed ? `Sold in: ${saleSpeed}` : 'Sale time: N/A'}</span>
              <span class="flex-shrink-0 ml-2">${soldTimeAgo}</span>
            </div>
            
            <div class="flex-grow"></div>
            <p class="text-lg font-bold text-primary mb-3">${item.price || 'Price N/A'}</p>
            
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" 
               class="block text-center w-full bg-transparent border border-primary text-primary font-bold py-2 px-4 rounded-md hover:bg-primary hover:text-primary-foreground transition-all duration-200 text-sm">
              View on Vinted
            </a>
          </div>
        </div>
      `;
    }).join("");
  }

  // Filter Management
  populateFilters() {
    const brands = new Set();
    const colors = new Set();
    const sizes = new Set();

    this.allSales.forEach(item => {
      const brand = this.extractBrand(item);
      if (brand) brands.add(brand);
      
      const size = this.extractSize(item.subtitle);
      if (size) sizes.add(size);
      
      const color = item.color_name ? item.color_name.split(',')[0].trim() : null;
      if (color) colors.add(color);
    });

    // Update filter dropdowns
    this.updateFilterDropdown('brand', [...brands].sort());
    this.updateFilterDropdown('color', [...colors].sort());
    this.updateFilterDropdown('size', this.sortSizes([...sizes]));
  }

  updateFilterDropdown(filterType, options) {
    const list = document.getElementById(`${filterType}FilterList`);
    if (!list) return;

    const createCheckbox = (name, value, isChecked) => `
      <label class="flex items-center w-full p-1.5 rounded hover:bg-gray-100 cursor-pointer">
        <input type="checkbox" name="${name}" value="${value}" ${isChecked ? 'checked' : ''} 
               class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary">
        <span class="ml-2 text-sm text-gray-800 truncate">${value}</span>
      </label>
    `;

    list.innerHTML = options.map(option => 
      createCheckbox(filterType, option, this.currentFilters[filterType].includes(option))
    ).join('');
  }

  sortSizes(sizes) {
    const sizeOrder = {
      'XXS': 1, 'XS': 2, 'S': 3, 'M': 4, 'L': 5, 'XL': 6, 
      'XXL': 7, '2XL': 7, 'XXXL': 8, '3XL': 8, 'XXXXL': 9, '4XL': 9, '5XL': 10
    };
    
    return sizes.sort((a, b) => {
      const aUpper = a.toUpperCase();
      const bUpper = b.toUpperCase();
      const aIsOrdered = sizeOrder[aUpper];
      const bIsOrdered = sizeOrder[bUpper];
      const aIsNumeric = !isNaN(parseFloat(a)) && isFinite(a);
      const bIsNumeric = !isNaN(parseFloat(b)) && isFinite(b);

      if (aIsOrdered && bIsOrdered) return sizeOrder[aUpper] - sizeOrder[bUpper];
      if (aIsNumeric && bIsNumeric) return parseFloat(a) - parseFloat(b);
      if (aIsOrdered && !bIsOrdered) return -1;
      if (!aIsOrdered && bIsOrdered) return 1;
      if (aIsNumeric && !bIsNumeric) return -1;
      if (!aIsNumeric && bIsNumeric) return 1;
      return a.localeCompare(b);
    });
  }

  // API and Data Management
  async fetchSales() {
    try {
      console.log('Fetching sales data from /api/sales...');
      const res = await fetch("/api/sales");
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const salesData = await res.json();
      console.log(`Loaded ${salesData.length} sales from sales.json`);
      
      this.allSales = salesData;
      this.lastUpdateTime = new Date();
      this.populateFilters();
      this.renderSales();
    } catch (err) {
      console.error("Failed to fetch sales:", err);
      this.salesContainer.innerHTML = 
        `<div class="col-span-full text-center py-12 text-destructive">
          <h2 class="text-xl font-semibold mb-2">Error loading sales data</h2>
          <p class="text-sm text-muted-foreground">Check console for details. Make sure the server is running.</p>
        </div>`;
    }
  }

  // Event Listeners
  setupEventListeners() {
    // Search
    if (this.searchBar) {
      this.searchBar.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderSales();
      });
    }

    // Sort
    if (this.sortOptions) {
      this.sortOptions.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderSales();
      });
    }

    // Export dropdown
    const exportBtn = document.getElementById('exportBtn');
    const exportDropdown = document.getElementById('exportDropdown');
    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('hidden');
      });
    }

    // Reset filters
    if (this.resetFiltersBtn) {
      this.resetFiltersBtn.addEventListener('click', () => {
        this.resetAllFilters();
      });
    }

    // Filter dropdowns
    ['brand', 'color', 'size'].forEach(filterType => {
      this.setupFilter(filterType);
    });

    // Close dropdowns on outside click
    window.addEventListener('click', () => {
      document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.add('hidden'));
      const exportDropdown = document.getElementById('exportDropdown');
      if (exportDropdown) exportDropdown.classList.add('hidden');
    });
    
    document.querySelectorAll('.filter-dropdown').forEach(d => {
      d.addEventListener('click', e => e.stopPropagation());
    });

    // Category links (for future implementation)
    document.querySelectorAll('.category-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const category = e.target.dataset.category;
        console.log(`Category filter clicked: ${category} (not implemented yet)`);
        // TODO: Implement category filtering when multiple categories are tracked
      });
    });
  }

  setupFilter(filterType) {
    const btn = document.getElementById(`${filterType}FilterBtn`);
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);
    const list = document.getElementById(`${filterType}FilterList`);
    const applyBtn = document.getElementById(`apply${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Filter`);
    const btnText = document.getElementById(`${filterType}FilterBtnText`);

    if (!btn || !dropdown || !list || !applyBtn || !btnText) {
      console.warn(`Filter elements missing for ${filterType}`);
      return;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.filter-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
      });
      dropdown.classList.toggle('hidden');
    });

    applyBtn.addEventListener('click', () => {
      const checked = list.querySelectorAll('input:checked');
      this.currentFilters[filterType] = Array.from(checked).map(cb => cb.value);
      dropdown.classList.add('hidden');
      
      const count = this.currentFilters[filterType].length;
      btnText.textContent = `${filterType.charAt(0).toUpperCase() + filterType.slice(1)}${count > 0 ? ` (${count})` : ''}`;
      btn.classList.toggle('filter-btn-active', count > 0);
      
      this.renderSales();
    });
  }

  // Initialize
  init() {
    console.log('Initializing VintedTrends Dashboard...');
    this.setupEventListeners();
    this.fetchSales();
    
    // Auto-refresh every 30 seconds to pick up new sales
    setInterval(() => {
      console.log('Auto-refreshing sales data...');
      this.fetchSales();
    }, 30000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, starting VintedTrends Dashboard...');
  window.vintedDashboard = new VintedDashboard();
});
